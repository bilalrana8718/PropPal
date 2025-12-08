# Chapter 4: Implementation and Testing

## 4.0 General Description

PropPal is an AI-driven, multi-agent real estate platform designed specifically for Pakistan's real estate market. The system leverages Natural Language Processing (NLP), Retrieval-Augmented Generation (RAG), and vector similarity search to provide intelligent, conversational property search and booking capabilities.

### 4.0.1 System Context

PropPal operates as a multi-tier architecture consisting of:

- **Frontend Layer**: Next.js web application providing user interface for buyers, sellers, and builders
- **API Gateway**: FastAPI-based backend service orchestrating multiple specialized agents
- **Multi-Agent System**: Specialized AI agents handling different aspects of real estate operations
- **Database Layer**: MongoDB Atlas with vector search capabilities for semantic property matching

### 4.0.2 Core Functionality

The system provides the following major functionalities:

1. **Conversational Property Search**: Users can search for properties using natural language queries (e.g., "3 bedroom house in Islamabad under 50 lakhs")
2. **Builder Discovery**: Search and discovery of construction companies and their services
3. **Intelligent Booking System**: Automated scheduling of property visits by matching buyer and seller availability
4. **Semantic Search**: Vector-based similarity search enabling flexible, context-aware property matching

### 4.0.3 Design Philosophy

PropPal follows a **multi-agent architecture** where specialized agents handle distinct domains:

- **Router Agent**: Acts as an orchestrator, classifying user queries and routing them to appropriate specialized agents
- **Listing Agent**: Handles property search and discovery
- **Builder Agent**: Manages builder profile and service searches
- **Booking Agent**: Coordinates visit scheduling between buyers and sellers

This design enables modularity, scalability, and the ability to add new specialized agents without disrupting existing functionality.

---

## 4.1 Algorithm Design

This section describes the core algorithms and pseudocode for PropPal's major modules.

### 4.1.1 Router Agent Algorithm

The Router Agent serves as the central orchestrator, classifying user queries and routing them to specialized agents. It uses a lightweight LLM for fast intent classification.

**Algorithm 1: Router Agent Query Classification and Routing**

```
Algorithm 1: RouterAgent QueryRouting

Input: user_query (string), clerk_id (optional string)
Output: Routed response from appropriate agent

1.  Initialize RouterState ← {query: user_query, clerk_id: clerk_id, messages: []}
2.  classification ← classify_intent(user_query)
3.  If (classification == "listing_agent") then
4.      ListingAgent ← get_listing_agent()
5.      result ← ListingAgent.process_query(user_query)
6.      Return result
7.  Else if (classification == "builder_agent") then
8.      BuilderAgent ← get_builder_agent()
9.      result ← BuilderAgent.process_query(user_query, clerk_id)
10.     Return result
11. Else if (classification == "booking_agent") then
12.     BookingAgent ← get_booking_agent()
13.     result ← BookingAgent.process_query(user_query, clerk_id)
14.     Return result
15. Else
16.     Return general_chat_response(user_query)
17. End if

Function classify_intent(query):
1.  prompt ← "Classify query as: listing_agent, builder_agent, booking_agent, or general_chat"
2.  classification ← LLM.classify(prompt, query)
3.  Return classification
```

**Key Features:**
- Fast intent classification using structured LLM output
- Stateless agent instantiation for each request
- Fallback to general chat for unclassified queries

---

### 4.1.2 Property Search Algorithm (Vector Similarity Search)

The Property Search algorithm uses vector embeddings to perform semantic similarity search, enabling natural language queries to match properties based on meaning rather than exact keyword matching.

**Algorithm 2: Property Vector Similarity Search**

```
Algorithm 2: PropertyVectorSearch

Input: query (string), k (integer) // k = number of results
Output: List of matching properties with similarity scores

1.  If (query is empty) then
2.      Return empty_results
3.  End if
4.  
5.  // Generate query embedding
6.  query_embedding ← embed_text(query)
7.  
8.  // Build vector search pipeline
9.  pipeline ← [
10.     {
11.         "$vectorSearch": {
12.             "index": "properties_embedding_index",
13.             "path": "embedding",
14.             "queryVector": query_embedding,
15.             "numCandidates": max(500, k * 10),
16.             "limit": k
17.         }
18.     },
19.     {
20.         "$project": {
21.             "score": {"$meta": "vectorSearchScore"},
22.             "title": 1,
23.             "price": 1,
24.             "city": 1,
25.             "area": 1,
26.             "property_type": 1,
27.             "bedrooms": 1,
28.             "bathrooms": 1,
29.             "area_sqft": 1,
30.             "images": 1
31.         }
32.     }
33. ]
34. 
35. // Execute search
36. results ← db["properties"].aggregate(pipeline).to_list(k)
37. 
38. // Normalize ObjectIds for JSON serialization
39. For each result in results do
40.     result["_id"] ← str(result["_id"])
41. End for
42. 
43. Return {
44.     "success": true,
45.     "query": query,
46.     "results": results,
47.     "count": length(results)
48. }
```

**Key Features:**
- Uses sentence transformer model (all-MiniLM-L6-v2) for embedding generation
- MongoDB Atlas vector search for efficient similarity computation
- Returns top-k most similar properties based on cosine similarity

---

### 4.1.3 Builder Search Algorithm

Similar to property search, the Builder Search algorithm performs vector similarity search on builder profiles and services, enabling users to find builders based on natural language descriptions.

**Algorithm 3: Builder Vector Similarity Search**

```
Algorithm 3: BuilderVectorSearch

Input: query (string), search_type (string) // "profile" or "service"
Output: List of matching builders/services with similarity scores

1.  If (query is empty) then
2.      Return empty_results
3.  End if
4.  
5.  // Generate query embedding
6.  query_embedding ← embed_text(query)
7.  
8.  // Select collection and index based on search_type
9.  If (search_type == "profile") then
10.     collection ← "builder_profiles"
11.     index_name ← "builder_profile_index"
12.     project_fields ← {
13.         "company_name": 1,
14.         "specialization": 1,
15.         "experience_years": 1,
16.         "city": 1,
17.         "contact_person": 1,
18.         "contact_email": 1,
19.         "contact_phone": 1
20.     }
21. Else if (search_type == "service") then
22.     collection ← "builder_services"
23.     index_name ← "builder_service_index"
24.     project_fields ← {
25.         "service_name": 1,
26.         "description": 1,
27.         "category": 1,
28.         "price_range_min": 1,
29.         "price_range_max": 1,
30.         "builder_id": 1
31.     }
32. End if
33. 
34. // Build vector search pipeline
35. pipeline ← [
36.     {
37.         "$vectorSearch": {
38.             "index": index_name,
39.             "path": "embeddings",
40.             "queryVector": query_embedding,
41.             "numCandidates": max(100, k * 10),
42.             "limit": k
43.         }
44.     },
45.     {
46.         "$project": {
47.             "score": {"$meta": "vectorSearchScore"},
48.             **project_fields
49.         }
50.     }
51. ]
52. 
53. // Execute search
54. results ← db[collection].aggregate(pipeline).to_list(k)
55. 
56. // Normalize ObjectIds
57. For each result in results do
58.     result["_id"] ← str(result["_id"])
59.     If ("builder_id" in result) then
60.         result["builder_id"] ← str(result["builder_id"])
61.     End if
62. End for
63. 
64. Return {
65.     "success": true,
66.     "query": query,
67.     "results": results,
68.     "count": length(results)
69. }
```

**Key Features:**
- Supports both profile and service-level searches
- Maintains referential integrity by preserving builder_id in service results
- Uses same embedding model for consistency across search types

---

### 4.1.4 Booking Agent Slot Matching Algorithm

The Booking Agent coordinates visit scheduling by matching buyer-preferred time slots with seller availability. It includes natural language date parsing and overlap computation.

**Algorithm 4: Booking Agent Slot Matching**

```
Algorithm 4: BookingAgent SlotMatching

Input: user_query (string), property_id (string), buyer_id (optional string)
Output: Matching time slots or booking confirmation

1.  // Extract property_id from query if not provided
2.  If (property_id is None) then
3.      property_id ← extract_property_id(user_query)
4.  End if
5.  
6.  // Step 1: Get seller availability
7.  seller_availability ← get_seller_slots(property_id)
8.  seller_slots ← seller_availability["slots"]
9.  
10. // Step 2: Extract buyer preferences from query
11. buyer_time_expression ← extract_time_expression(user_query)
12. 
13. If (buyer_time_expression is not empty) then
14.     // Step 3: Parse natural language dates
15.     If (is_natural_language(buyer_time_expression)) then
16.         buyer_slots ← parse_natural_language_dates(buyer_time_expression)
17.     Else
18.         buyer_slots ← parse_iso_dates(buyer_time_expression)
19.     End if
20.     
21.     // Step 4: Compute overlap
22.     overlap ← compute_slot_overlap(buyer_slots, seller_slots)
23.     
24.     If (overlap is not empty) then
25.         Return {
26.             "success": true,
27.             "overlap": overlap,
28.             "overlap_readable": format_dates_readable(overlap),
29.             "message": "Found matching times: [overlap_readable]"
30.         }
31.     Else
32.         Return {
33.             "success": true,
34.             "overlap": [],
35.             "seller_slots_readable": format_dates_readable(seller_slots),
36.             "message": "No overlap. Seller available: [seller_slots_readable]"
37.         }
38.     End if
39. Else
40.     // No buyer preferences provided
41.     Return {
42.         "success": true,
43.         "seller_slots_readable": format_dates_readable(seller_slots),
44.         "message": "Seller available: [seller_slots_readable]. When would you like to visit?"
45.     }
46. End if

Function compute_slot_overlap(buyer_slots, seller_slots):
1.  overlap ← intersection(buyer_slots, seller_slots)
2.  overlap ← sort_by_datetime(overlap)
3.  Return overlap

Function parse_natural_language_dates(text):
1.  results ← []
2.  base_date ← current_date()
3.  
4.  // Handle day names: "Saturday", "Monday", etc.
5.  For each day_name in ["monday", "tuesday", ..., "sunday"] do
6.      If (day_name in text.lower()) then
7.          days_ahead ← compute_days_until(day_name, base_date)
8.          target_date ← base_date + days_ahead
9.          
10.         // Extract time: "2PM", "afternoon", etc.
11.         time_info ← extract_time(text)
12.         If (time_info is not None) then
13.             datetime ← combine_date_time(target_date, time_info)
14.             results.append(datetime.isoformat())
15.         End if
16.     End if
17. End for
18. 
19. // Handle relative dates: "tomorrow", "next week"
20. If ("tomorrow" in text.lower()) then
21.     target_date ← base_date + 1 day
22.     time_info ← extract_time(text) or default_time()
23.     datetime ← combine_date_time(target_date, time_info)
24.     results.append(datetime.isoformat())
25. End if
26. 
27. // Handle specific dates: "January 20th at 2pm"
28. date_match ← regex_match("(month_name) (day) at (time)", text)
29. If (date_match is not None) then
30.     datetime ← parse_specific_date(date_match)
31.     results.append(datetime.isoformat())
32. End if
33. 
34. Return results
```

**Key Features:**
- Natural language date parsing supporting multiple formats
- Efficient set intersection for overlap computation
- Human-readable date formatting for user responses
- Handles timezone-aware datetime objects

---

### 4.1.5 Listing Agent Workflow Algorithm

The Listing Agent orchestrates property search through a cyclical agent pattern, allowing iterative refinement of search queries.

**Algorithm 5: Listing Agent Workflow**

```
Algorithm 5: ListingAgent Workflow

Input: user_query (string)
Output: Property search results and conversational response

1.  Initialize AgentState ← {
2.      messages: [HumanMessage(user_query)],
3.      query: user_query,
4.      data: {},
5.      success: false,
6.      response: ""
7.  }
8.  
9.  // Main agent loop
10. While (not finished) do
11.     // Agent decides on action
12.     agent_response ← LLM_with_tools.invoke(state.messages)
13.     
14.     // Check if agent wants to use tool
15.     If (agent_response has tool_calls) then
16.         // Execute property search tool
17.         tool_results ← execute_tool(property_search_tool, agent_response.tool_calls)
18.         state.messages.append(ToolMessage(tool_results))
19.         Continue loop
20.     Else
21.         // Agent provides final response
22.         state.response ← agent_response.content
23.         state.success ← true
24.         Break loop
25.     End if
26. End while
27. 
28. Return {
29.     "success": state.success,
30.     "response": state.response,
31.     "data": {
32.         "properties": extract_properties_from_messages(state.messages)
33.     }
34. }
```

**Key Features:**
- Cyclical agent pattern allowing iterative tool use
- Automatic tool invocation based on LLM decision
- Conversational response generation with embedded search results

---

## 4.2 Implementation Details

### 4.2.1 Technology Stack

- **Backend Framework**: FastAPI (Python 3.13)
- **AI/ML**: LangChain, LangGraph, Groq LLM (Llama 3.1), Sentence Transformers
- **Database**: MongoDB Atlas with vector search indexes
- **Frontend**: Next.js 15, React 19, TypeScript
- **Embedding Model**: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)

### 4.2.2 Vector Search Implementation

Properties, builder profiles, and services are pre-processed to generate embeddings using the sentence transformer model. These embeddings are stored in MongoDB with vector search indexes, enabling sub-second similarity search on large datasets.

### 4.2.3 Agent Communication Pattern

Agents communicate through a state-based graph structure (LangGraph), where:
- Each agent maintains its own state
- Messages flow through the graph nodes
- Tool execution is handled by specialized tool nodes
- Conditional edges route based on agent decisions

---

## 4.3 Current Implementation Status

As of the current iteration, the following modules are implemented:

✅ **Router Agent**: Fully functional with intent classification  
✅ **Listing Agent**: Property search with vector similarity  
✅ **Builder Agent**: Builder profile and service search  
✅ **Booking Agent**: Slot matching and visit scheduling  
✅ **Vector Search Infrastructure**: MongoDB Atlas vector indexes  
✅ **Embedding Service**: Sentence transformer integration  

**In Progress:**
- Enhanced natural language understanding for complex queries
- Multi-agent workflow orchestration
- Performance optimization for large-scale searches

---

*Note: This chapter documents the implementation up to the current iteration. Future enhancements and optimizations will be documented in subsequent updates.*

