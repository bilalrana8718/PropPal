"""
Router Agent - Orchestrator for multiple specialized agents.
Routes user queries to the appropriate specialized agent.
"""

import operator
import os
from typing import TypedDict, Annotated, List, Optional, Dict
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from dotenv import load_dotenv
# Load .env file
load_dotenv()

# Import the ListingAgent
from agents.listing.agent import ListingAgent
from .builder.agent import BuilderAgent
from .booking.agent import BookingAgent

# --- Define the Router's State ---
# This is the state for the *main orchestrator* graph.
class RouterState(TypedDict):
    # The user's original query
    query: str

    # User identifier for creation tasks
    clerk_id: Optional[str]
    
    # The classification result from the router
    classification: str
    
    # The list of messages (conversation history)
    # operator.add allows us to append messages to this list
    messages: Annotated[List[BaseMessage], operator.add]
    
    # Properties and builders from agent responses
    properties: List[dict]
    builders: List[dict]
    services: List[dict]
    booking: List[dict]
    
    # Metadata for additional information (like interactive session flags)
    metadata: Optional[dict]
    
    # Conversation history for context-aware classification
    conversation_history: Optional[List[Dict[str, str]]]
    
    # Booking mode flag - when True, stay in booking context
    booking_mode: Optional[bool]

# --- LLM and Router Definition ---

# Initialize the LLM for the router
# This LLM's only job is to classify the query, so it's very fast.
llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.0
)

# Define the structured output for our router
class RouteQuery(BaseModel):
    """Classify the user's query to route it to the correct agent."""
    destination: str = Field(
        description="The destination node. Must be one of 'listing_agent', 'builder_agent', 'booking_agent', or 'general_chat'."
    )

# Bind the structured output to the LLM
classify_llm = llm.with_structured_output(RouteQuery)

# --- Agent Factory Functions ---
# We create fresh instances of agents to avoid state issues
def get_listing_agent():
    """Get a fresh instance of ListingAgent."""
    return ListingAgent()

def get_builder_agent():
    """Get a fresh instance of BuilderAgent."""
    return BuilderAgent()

def get_booking_agent():
    """Get a fresh instance of BookingAgent."""
    return BookingAgent()

# In the future, you could add:
# def get_financial_agent():
#     return FinancialAgent()
# def get_support_agent():
#     return SupportAgent()


# --- Main Router Graph Nodes ---

def classify_intent_node(state: RouterState):
    """
    This is the first node that runs. It classifies the user's query.
    Uses conversation history for context-aware classification.
    If in booking_mode, handles classification differently.
    """
    print("--- [Main Graph] Classifying Intent ---")
    query = state['query']
    conversation_history = state.get('conversation_history', [])
    booking_mode = state.get('booking_mode', False)
    
    # If we're in booking mode, check if this is a booking-related query
    if booking_mode:
        print("--- [Main Graph] BOOKING MODE ACTIVE - Checking query type ---")
        query_lower = query.lower().strip()
        
        # Keywords that indicate booking-related conversation
        booking_keywords = [
            'yes', 'no', 'confirm', 'book', 'schedule', 'visit', 'viewing', 'tour',
            'available', 'time', 'slot', 'monday', 'tuesday', 'wednesday', 'thursday',
            'friday', 'saturday', 'sunday', 'tomorrow', 'today', 'morning', 'afternoon',
            'evening', 'am', 'pm', 'property', 'seller', 'cancel', 'reschedule'
        ]
        
        # Check if query contains booking keywords
        is_booking_related = any(keyword in query_lower for keyword in booking_keywords)
        
        if is_booking_related:
            print("--- [Main Graph] Query is booking-related, routing to booking_agent ---")
            return {"classification": "booking_agent"}
        else:
            # Off-topic question in booking mode - handle with general chat
            print("--- [Main Graph] Off-topic question in booking mode, using general_chat ---")
            return {"classification": "general_chat"}
    
    # Normal classification flow (not in booking mode)
    # Build context from history
    context_str = ""
    if conversation_history:
        # Get last 4 messages (2 exchanges) for context
        recent = conversation_history[-4:]
        context_lines = [f"{msg['role']}: {msg['content']}" for msg in recent]
        context_str = "\n".join(context_lines)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are an expert router for PropPal, a real estate platform. "
            "Your job is to classify the user's query based on the current message AND conversation context.\n\n"
            "CONVERSATION CONTEXT (recent messages):\n{context}\n\n"
            "CLASSIFICATION RULES:\n"
            "- If the user is responding to a booking confirmation question (e.g., 'yes', 'confirm', 'book it', 'sure') "
            "AND the last assistant message asked about confirming a visit or mentioned 'Should I confirm', classify as 'booking_agent'\n"
            "- If asking about properties, listings, houses, apartments, buying, selling, renting: 'listing_agent'\n"
            "- If asking about builders, contractors, construction companies, or construction professionals: 'builder_agent'\n"
            "- If asking about builder services (plumbing, electrical, interior design, renovation, etc.): 'builder_agent'\n"
            "- If asking about booking visits, scheduling tours, arranging viewings: 'booking_agent'\n"
            "- For general questions, greetings, platform help: 'general_chat'\n"
        )),
        ("human", "{query}")
    ])
    
    chain = prompt | classify_llm
    result = chain.invoke({"query": query, "context": context_str})
    
    print(f"--- [Main Graph] Classification: {result.destination} (with context: {bool(context_str)}) ---")
    return {"classification": result.destination}

def general_chat_node(state: RouterState):
    """
    This node handles all non-property-related queries (e.g., "Hello").
    In booking mode, provides brief answers to off-topic questions.
    """
    print("--- [Main Graph] Executing General Chat ---")
    query = state['query']
    booking_mode = state.get('booking_mode', False)
    
    if booking_mode:
        # In booking mode, give brief answers and redirect back to booking
        prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are a helpful assistant for PropPal's booking system. "
                "The user is currently in a property visit booking conversation. "
                "Answer their question briefly (1-2 sentences max), then gently remind them "
                "that you're here to help them schedule their property visit. "
                "Keep responses short and friendly."
            )),
            ("human", "{query}")
        ])
    else:
        # Normal general chat
        prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are a helpful assistant for PropPal, a real estate platform. "
                "You can help users with general questions about the platform, "
                "account issues, or general conversation. You do *not* search for properties. "
                "If users ask about property-related topics, politely redirect them to "
                "ask about specific property searches."
            )),
            ("human", "{query}")
        ])
    
    chain = prompt | llm
    result = chain.invoke({"query": query})
    
    return {"messages": [result]}

def listing_agent_node(state: RouterState):
    """
    Acts as a client to ListingAgent and formats the response.
    """
    print("--- [Main Graph] Routing to Listing Agent ---")
    query = state['query']
    listing_agent = get_listing_agent()
    result = listing_agent.process_query(query)
    
    response_message = result.get("response", "An error occurred in the listing agent.")
    properties = result.get("properties", [])
    
    if not result.get("success"):
        print(f"--- [Main Graph] Listing Agent Error: {result.get('error')}")
        
    return {
        "messages": [AIMessage(content=response_message)],
        "properties": properties
    }

def builder_agent_node(state: RouterState):
    """
    Acts as a client to BuilderAgent and formats the response.
    """
    print("--- [Main Graph] Routing to Builder Agent ---")
    query = state['query']
    clerk_id = state.get('clerk_id')

    builder_agent = get_builder_agent()
    result = builder_agent.process_query(query, clerk_id=clerk_id)

    try:
        print("--- [Main Graph] Raw BuilderAgent result:", {
            "keys": list(result.keys()),
            "success": result.get("success"),
            "classification": result.get("classification"),
            "results_len": len(result.get("results", []) or []),
            "builders_len": len(result.get("builders", []) or []),
            "services_len": len(result.get("services", []) or []),
        })
    except Exception:
        pass

    response_message = result.get("response", "An error occurred in the builder agent.")
    raw_results = result.get("results", [])
    builders = result.get("builders", [])
    services = result.get("services", [])
    if raw_results and (not builders or not services):
        tmp_builders, tmp_services = [], []
        for item in raw_results:
            if any(k in item for k in ["service_name", "builder_id", "category", "price_range_min", "price_range_max"]):
                tmp_services.append(item)
            else:
                tmp_builders.append(item)
        if not builders:
            builders = tmp_builders
        if not services:
            services = tmp_services
    if not result.get("success"):
        print(f"--- [Main Graph] Builder Agent Error: {result.get('error')}")

    response_payload = {
        "messages": [AIMessage(content=response_message)],
        "builders": builders,
        "services": services,
    }
    if result.get("metadata"):
        response_payload["metadata"] = result["metadata"]

    try:
        print("--- [Main Graph] BuilderAgent normalized payload:", {
            "builders_len": len(response_payload["builders"] or []),
            "services_len": len(response_payload["services"] or []),
            "has_metadata": "metadata" in response_payload,
        })
    except Exception:
        pass

    return response_payload

def booking_agent_node(state: RouterState):
    """
    Delegates to BookingAgent for visit scheduling.
    """
    print("--- [Main Graph] Routing to Booking Agent ---")
    query = state['query']
    clerk_id = state.get('clerk_id')
    conversation_history = state.get('conversation_history', [])
    
    buyer_id = None
    if clerk_id:
        try:
            # Use synchronous MongoDB client to avoid event loop issues
            from pymongo import MongoClient
            import os
            
            # Get MongoDB URI from environment
            mongo_uri = os.getenv("MONGODB_URL")
            if mongo_uri:
                # Create synchronous client
                client = MongoClient(mongo_uri)
                db = client["proppal"]
                
                # Query user by clerk_id
                user_doc = db.users.find_one({"clerk_id": clerk_id})
                if user_doc and "_id" in user_doc:
                    buyer_id = str(user_doc["_id"])
                
                # Close client
                client.close()
        except Exception as e:
            print(f"--- [Main Graph] Failed to resolve buyer_id: {e}")
            buyer_id = None

    booking_agent = get_booking_agent()
    result = booking_agent.process_query(
        query,
        buyer_id=buyer_id,
        conversation_history=conversation_history
    )

    response_message = result.get("response", "An error occurred in the booking agent.")
    booking_data = result.get("data", {})

    if not result.get("success"):
        print(f"--- [Main Graph] Booking Agent Error: {result.get('error')}")

    return {
        "messages": [AIMessage(content=response_message)],
        "booking": [booking_data] if booking_data else [],
    }

# --- Conditional Routing Function ---

def route_after_classification(state: RouterState):
    """
    Reads 'classification' from state and returns the next node.
    """
    classification = state.get("classification")
    
    if classification == "listing_agent":
        return "listing_agent_node"
    elif classification == "builder_agent":
        return "builder_agent_node"
    elif classification == "booking_agent":
        return "booking_agent_node"
    else:
        return "general_chat_node"

# --- Build the Main Router Graph ---

workflow = StateGraph(RouterState)
workflow.add_node("classifier", classify_intent_node)
workflow.add_node("general_chat_node", general_chat_node)
workflow.add_node("listing_agent_node", listing_agent_node)
workflow.add_node("builder_agent_node", builder_agent_node)
workflow.add_node("booking_agent_node", booking_agent_node)

workflow.set_entry_point("classifier")

workflow.add_conditional_edges(
    "classifier",
    route_after_classification,
    {
        "listing_agent_node": "listing_agent_node",
        "general_chat_node": "general_chat_node",
        "builder_agent_node": "builder_agent_node",
        "booking_agent_node": "booking_agent_node",
    }
)

workflow.add_edge("general_chat_node", END)
workflow.add_edge("listing_agent_node", END)
workflow.add_edge("builder_agent_node", END)
workflow.add_edge("booking_agent_node", END)

router_agent_app = workflow.compile()

# --- Public API for the Router Agent ---

class RouterAgent:
    """
    Public interface for the Router Agent.
    Provides a clean API for external use.
    """
    
    def __init__(self):
        self.app = router_agent_app
        self.name = "RouterAgent"
    
    def process_query(
        self,
        query: str,
        clerk_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        booking_mode: bool = False
    ) -> dict:
        """
        Process a user query through the router agent.
        
        Args:
            query: The user's query/message
            clerk_id: Optional Clerk user ID for authentication
            conversation_history: Optional list of recent messages for context
            booking_mode: If True, stay in booking context and handle off-topic with general chat
        """
        if not query or not query.strip():
            return {
                "success": False,
                "response": "Please provide a valid query.",
                "classification": "error",
                "properties": [],
                "builders": [],
                "services": [],
                "booking": [],
                "error": "Empty query provided"
            }
        
        try:
            initial_state = RouterState(
                query=query.strip(),
                clerk_id=clerk_id,
                classification="",
                messages=[],
                properties=[],
                builders=[],
                services=[],
                booking=[],
                metadata=None,
                conversation_history=conversation_history or [],
                booking_mode=booking_mode
            )
            
            final_state = self.app.invoke(initial_state)
            
            if final_state.get("messages"):
                final_message = final_state["messages"][-1]
                response_content = final_message.content if hasattr(final_message, 'content') else str(final_message)
            else:
                response_content = "No response generated"
            
            response_obj = {
                "success": True,
                "response": response_content,
                "classification": final_state.get("classification", "unknown"),
                "properties": final_state.get("properties", []),
                "builders": final_state.get("builders", []),
                "services": final_state.get("services", []),
                "booking": final_state.get("booking", []),
                "error": None
            }

            if final_state.get("metadata"):
                response_obj["metadata"] = final_state["metadata"]

            try:
                print("--- [Main Graph] Router final response summary:", {
                    "classification": response_obj["classification"],
                    "properties_len": len(response_obj["properties"] or []),
                    "builders_len": len(response_obj["builders"] or []),
                    "services_len": len(response_obj["services"] or []),
                })
            except Exception:
                pass
            return response_obj
            
        except Exception as e:
            return {
                "success": False,
                "response": f"An error occurred while processing your query: {str(e)}",
                "classification": "error",
                "properties": [],
                "builders": [],
                "services": [],
                "booking": [],
                "error": str(e)
            }