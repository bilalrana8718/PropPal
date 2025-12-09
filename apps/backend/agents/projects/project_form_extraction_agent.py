"""
Specialized agent for extracting project form fields from natural language.
Uses LLM to extract structured project data and sends updates via WebSocket.
This agent is for FORM FILLING mode - extracting fields from text to populate form.
"""

import logging
import re
import os
from typing import Awaitable, Callable, Dict, Any, Optional, List
from pydantic import BaseModel, Field

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize LLM for project extraction
_extraction_llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.0
)

# Filler words and phrases to remove
FILLER_WORDS = {
    'uh', 'um', 'er', 'ah', 'oh', 'hmm', 'hm',
    'like', 'you know', 'you see', 'i mean', 'well',
    'actually', 'basically', 'literally', 'sort of', 'kind of',
    'right', 'okay', 'ok', 'so', 'yeah', 'yep', 'yup',
    'i guess', 'i think', 'i suppose', 'maybe', 'perhaps'
}

# Common cities in Pakistan
PAKISTAN_CITIES = [
    'Islamabad', 'Karachi', 'Lahore', 'Rawalpindi', 'Peshawar',
    'Quetta', 'Faisalabad', 'Multan', 'Hyderabad', 'Sialkot',
    'Gujranwala', 'Abbottabad', 'Bahawalpur', 'Sargodha', 'Sukkur'
]

# Project type keywords
PROJECT_TYPE_KEYWORDS = {
    'construction': ['construction', 'build', 'building', 'new construction', 'house building'],
    'renovation': ['renovation', 'renovate', 'remodel', 'remodeling', 'refurbish'],
    'interior': ['interior', 'interior design', 'decor', 'decoration', 'furnishing'],
    'plumbing': ['plumbing', 'pipes', 'drainage', 'water', 'bathroom fixtures'],
    'electrical': ['electrical', 'wiring', 'electrical work', 'electricity', 'circuit'],
    'painting': ['painting', 'paint', 'wall paint', 'exterior paint', 'interior paint'],
    'flooring': ['flooring', 'tiles', 'floor', 'marble', 'wood flooring'],
    'roofing': ['roofing', 'roof', 'roof repair', 'leakage'],
    'landscaping': ['landscaping', 'garden', 'lawn', 'outdoor', 'patio'],
    'kitchen': ['kitchen', 'kitchen remodel', 'modular kitchen'],
    'bathroom': ['bathroom', 'bath', 'washroom'],
    'hvac': ['hvac', 'ac', 'air conditioning', 'heating', 'ventilation'],
}


def _clean_text(text: str) -> str:
    """Remove filler words and clean up text for better extraction."""
    if not text:
        return ""
    
    cleaned = text
    for filler in sorted(FILLER_WORDS, key=len, reverse=True):
        pattern = r'\b' + re.escape(filler) + r'\b'
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = cleaned.strip(' ,.-')
    
    return cleaned.strip()


def _detect_project_type(text: str) -> Optional[str]:
    """Detect project type from text."""
    text_lower = text.lower()
    
    for project_type, keywords in PROJECT_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return project_type
    
    return None


def _detect_city(text: str) -> Optional[str]:
    """Detect city from text."""
    text_lower = text.lower()
    
    for city in PAKISTAN_CITIES:
        if city.lower() in text_lower:
            return city
    
    return None


def _extract_budget(text: str) -> tuple[Optional[float], Optional[float]]:
    """Extract budget range from text."""
    patterns = [
        # Range patterns: 5 lakh to 10 lakh, 5-10 lakh
        r'(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(lakh|lac|million|crore|k|thousand)?',
        # Single budget with min/max indicator
        r'(?:budget|cost)\s*(?:is|of)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac|million|crore|k|thousand)?',
        # Just numbers with currency indicators
        r'(?:PKR|Rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)',
    ]
    
    text_lower = text.lower()
    
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            groups = match.groups()
            if len(groups) >= 2 and groups[1] and groups[1].replace('.', '').isdigit():
                # Range found
                min_val = float(groups[0])
                max_val = float(groups[1])
                multiplier = _get_multiplier(groups[2] if len(groups) > 2 else None)
                return min_val * multiplier, max_val * multiplier
            elif len(groups) >= 1:
                # Single value
                val = float(groups[0].replace(',', ''))
                multiplier = _get_multiplier(groups[1] if len(groups) > 1 else None)
                # For single value, set min as 80% and max as 120%
                budget = val * multiplier
                return budget * 0.8, budget * 1.2
    
    return None, None


def _get_multiplier(unit: Optional[str]) -> float:
    """Get multiplier based on unit."""
    if not unit:
        return 1
    
    unit = unit.lower()
    if unit in ['lakh', 'lac']:
        return 100000
    elif unit == 'million':
        return 1000000
    elif unit == 'crore':
        return 10000000
    elif unit in ['k', 'thousand']:
        return 1000
    
    return 1


def _extract_timeline(text: str) -> Optional[str]:
    """Extract timeline from text."""
    patterns = [
        r'(\d+)\s*(?:to|-)\s*(\d+)\s*(days?|weeks?|months?|years?)',
        r'(?:within|in|by)\s*(\d+)\s*(days?|weeks?|months?|years?)',
        r'(\d+)\s*(days?|weeks?|months?|years?)',
    ]
    
    text_lower = text.lower()
    
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            groups = match.groups()
            if len(groups) >= 3 and groups[1]:
                return f"{groups[0]}-{groups[1]} {groups[2]}"
            elif len(groups) >= 2:
                return f"{groups[0]} {groups[1]}"
    
    return None


class ExtractedProjectData(BaseModel):
    """Structure for extracted project data"""
    title: Optional[str] = Field(None, description="Project title")
    description: Optional[str] = Field(None, description="Project description")
    project_type: Optional[str] = Field(None, description="Type of project")
    budget_min: Optional[float] = Field(None, description="Minimum budget")
    budget_max: Optional[float] = Field(None, description="Maximum budget")
    location: Optional[str] = Field(None, description="Project location/address")
    city: Optional[str] = Field(None, description="City")
    timeline: Optional[str] = Field(None, description="Expected timeline")
    requirements: Optional[List[str]] = Field(None, description="Specific requirements")


# LLM extraction prompt
EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a project data extraction assistant. Extract project information from user's natural language description.

Extract the following fields if mentioned:
- title: A concise title for the project
- description: Detailed description of what needs to be done
- project_type: One of: construction, renovation, interior, plumbing, electrical, painting, flooring, roofing, landscaping, kitchen, bathroom, hvac, or other
- budget_min: Minimum budget in PKR (convert lakhs to actual number: 1 lakh = 100000)
- budget_max: Maximum budget in PKR
- location: Specific address or area
- city: City name (Pakistani cities)
- timeline: Expected completion time (e.g., "2-3 months")
- requirements: List of specific requirements mentioned

Return ONLY a valid JSON object with the extracted fields. Use null for fields not mentioned.
Do NOT include any explanatory text, only the JSON object.

Example output:
{{"title": "Kitchen Renovation", "description": "Complete kitchen remodel with new cabinets", "project_type": "kitchen", "budget_min": 500000, "budget_max": 700000, "location": "DHA Phase 5", "city": "Lahore", "timeline": "2-3 months", "requirements": ["modular cabinets", "granite countertop"]}}"""),
    ("human", "Extract project information from this text: {text}")
])


async def _extract_with_llm(text: str) -> Dict[str, Any]:
    """Use LLM to extract project data."""
    try:
        chain = EXTRACTION_PROMPT | _extraction_llm
        response = await chain.ainvoke({"text": text})
        
        # Parse JSON from response
        content = response.content.strip()
        
        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
        if json_match:
            import json
            return json.loads(json_match.group())
        
        return {}
    except Exception as e:
        logger.error(f"LLM extraction error: {e}")
        return {}


class ProjectFormExtractionAgent:
    """
    Agent for extracting project form fields from natural language.
    Single-pass extraction - extracts all fields at once and returns.
    """
    
    def __init__(
        self,
        send_update: Callable[[Dict[str, Any]], Awaitable[None]],
        user_id: str
    ):
        """
        Initialize the project form extraction agent.
        
        Args:
            send_update: Async callback to send updates to client via WebSocket
            user_id: The ID of the user creating the project
        """
        self.send_update = send_update
        self.user_id = user_id
    
    async def process_input(self, text: str) -> Dict[str, Any]:
        """
        Process user input and extract project form fields.
        Single-pass extraction - returns extracted fields immediately.
        
        Args:
            text: User's natural language input describing the project
            
        Returns:
            Dictionary with extracted fields
        """
        try:
            # Clean the input text
            cleaned_text = _clean_text(text)
            
            if not cleaned_text:
                await self.send_update({
                    "type": "project_form_update",
                    "data": {"error": "No valid input received"}
                })
                return {"error": "No valid input"}
            
            # Send processing status
            await self.send_update({
                "type": "project_form_update",
                "data": {"status": "processing", "message": "Extracting project details..."}
            })
            
            # Use LLM for comprehensive extraction
            llm_extracted = await _extract_with_llm(cleaned_text)
            
            # Also try rule-based extraction for certain fields as fallback
            detected_type = _detect_project_type(cleaned_text)
            detected_city = _detect_city(cleaned_text)
            budget_min, budget_max = _extract_budget(cleaned_text)
            detected_timeline = _extract_timeline(cleaned_text)
            
            # Merge results, preferring LLM results but using rule-based as fallback
            extracted_data = {
                "title": llm_extracted.get("title"),
                "description": llm_extracted.get("description"),
                "project_type": llm_extracted.get("project_type") or detected_type,
                "budget_min": llm_extracted.get("budget_min") or budget_min,
                "budget_max": llm_extracted.get("budget_max") or budget_max,
                "location": llm_extracted.get("location"),
                "city": llm_extracted.get("city") or detected_city,
                "timeline": llm_extracted.get("timeline") or detected_timeline,
                "requirements": llm_extracted.get("requirements") or [],
            }
            
            # Filter out None values
            extracted_data = {k: v for k, v in extracted_data.items() if v is not None}
            
            # Send the extracted data
            await self.send_update({
                "type": "project_form_update",
                "data": {
                    "status": "complete",
                    "extracted_fields": extracted_data,
                    "message": f"Extracted {len(extracted_data)} fields"
                }
            })
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"Error in project form extraction: {e}")
            await self.send_update({
                "type": "project_form_update",
                "data": {"status": "error", "error": str(e)}
            })
            return {"error": str(e)}


async def handle_project_form_extract(
    send_update: Callable[[Dict[str, Any]], Awaitable[None]],
    user_id: str,
    message: str
) -> Dict[str, Any]:
    """
    Handler function for project form extraction via WebSocket.
    
    Args:
        send_update: Async callback to send updates to client
        user_id: The user's ID
        message: The user's natural language input
        
    Returns:
        Dictionary with extracted fields
    """
    agent = ProjectFormExtractionAgent(send_update=send_update, user_id=user_id)
    return await agent.process_input(message)
