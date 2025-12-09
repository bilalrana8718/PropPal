"""
Specialized agent for extracting bid/proposal form fields from natural language.
Uses LLM to extract structured bid data and sends updates via WebSocket.
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

# Initialize LLM for bid extraction
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

# Common materials
COMMON_MATERIALS = [
    'cement', 'bricks', 'sand', 'gravel', 'steel', 'concrete',
    'wood', 'plywood', 'tiles', 'marble', 'granite', 'paint',
    'pipes', 'wiring', 'fixtures', 'glass', 'aluminum',
    'pvc', 'copper', 'insulation', 'drywall', 'plaster'
]


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


def _extract_cost(text: str) -> Optional[float]:
    """Extract estimated cost from text."""
    patterns = [
        # With currency indicators
        r'(?:PKR|Rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|lac|million|crore|k|thousand)?',
        # Cost/price mentioned
        r'(?:cost|price|charge|estimate|quote)\s*(?:is|of|around|about)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|lac|million|crore|k|thousand)?',
        # Just numbers with units
        r'(\d+(?:\.\d+)?)\s*(lakh|lac|million|crore)\b',
    ]
    
    text_lower = text.lower()
    
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            groups = match.groups()
            val = float(groups[0].replace(',', ''))
            unit = groups[1] if len(groups) > 1 else None
            multiplier = _get_multiplier(unit)
            return val * multiplier
    
    return None


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


def _extract_duration(text: str) -> Optional[str]:
    """Extract duration from text."""
    patterns = [
        r'(\d+)\s*(?:to|-)\s*(\d+)\s*(days?|weeks?|months?|years?)',
        r'(?:within|in|take|takes|complete)\s*(\d+)\s*(days?|weeks?|months?|years?)',
        r'(\d+)\s*(days?|weeks?|months?|years?)\s*(?:to complete|duration|time)',
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


def _extract_materials(text: str) -> List[str]:
    """Extract mentioned materials from text."""
    text_lower = text.lower()
    found_materials = []
    
    for material in COMMON_MATERIALS:
        if material in text_lower:
            found_materials.append(material)
    
    return found_materials


class ExtractedBidData(BaseModel):
    """Structure for extracted bid data"""
    proposal_title: Optional[str] = Field(None, description="Proposal title")
    proposal_details: Optional[str] = Field(None, description="Detailed proposal")
    estimated_cost: Optional[float] = Field(None, description="Estimated cost")
    estimated_duration: Optional[str] = Field(None, description="Estimated duration")
    approach: Optional[str] = Field(None, description="Approach/methodology")
    materials: Optional[List[str]] = Field(None, description="Materials to be used")


# LLM extraction prompt
EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a proposal/bid data extraction assistant. Extract bid information from a builder's natural language description.

Extract the following fields if mentioned:
- proposal_title: A concise title for the proposal/bid
- proposal_details: Detailed description of what the builder will do
- estimated_cost: Total cost in PKR (convert lakhs to actual number: 1 lakh = 100000)
- estimated_duration: How long the work will take (e.g., "2-3 weeks", "1 month")
- approach: The builder's approach/methodology to complete the project
- materials: List of materials that will be used

Return ONLY a valid JSON object with the extracted fields. Use null for fields not mentioned.
Do NOT include any explanatory text, only the JSON object.

Example output:
{{"proposal_title": "Complete Kitchen Renovation", "proposal_details": "I will renovate your kitchen with modern cabinets, granite countertops, and new appliances installation. This includes demolition, plumbing, electrical work, and final finishing.", "estimated_cost": 650000, "estimated_duration": "3-4 weeks", "approach": "Phase-wise approach starting with demolition, then plumbing and electrical, followed by cabinet installation and finishing", "materials": ["granite", "plywood", "paint", "tiles"]}}"""),
    ("human", "Extract bid/proposal information from this text: {text}")
])


async def _extract_with_llm(text: str) -> Dict[str, Any]:
    """Use LLM to extract bid data."""
    import json
    try:
        logger.info(f"[BidExtract] Starting LLM extraction for text: {text[:100]}...")
        chain = EXTRACTION_PROMPT | _extraction_llm
        response = await chain.ainvoke({"text": text})
        
        # Parse JSON from response
        content = response.content.strip()
        logger.info(f"[BidExtract] LLM response: {content}")
        
        # Try to parse the entire response as JSON first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON object in the response (handles nested braces like arrays)
        # Look for pattern starting with { and ending with }
        start_idx = content.find('{')
        if start_idx != -1:
            # Count braces to find the matching closing brace
            brace_count = 0
            end_idx = start_idx
            for i, char in enumerate(content[start_idx:], start_idx):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i
                        break
            
            if brace_count == 0:
                json_str = content[start_idx:end_idx + 1]
                try:
                    result = json.loads(json_str)
                    logger.info(f"[BidExtract] Successfully extracted: {result}")
                    return result
                except json.JSONDecodeError as e:
                    logger.error(f"[BidExtract] JSON decode error: {e}, raw: {json_str}")
        
        logger.warning(f"[BidExtract] Could not find valid JSON in response")
        return {}
    except Exception as e:
        logger.error(f"[BidExtract] LLM extraction error: {e}", exc_info=True)
        return {}


class BidFormExtractionAgent:
    """
    Agent for extracting bid/proposal form fields from natural language.
    Single-pass extraction - extracts all fields at once and returns.
    """
    
    def __init__(
        self,
        send_update: Callable[[Dict[str, Any]], Awaitable[None]],
        builder_id: str
    ):
        """
        Initialize the bid form extraction agent.
        
        Args:
            send_update: Async callback to send updates to client via WebSocket
            builder_id: The ID of the builder creating the bid
        """
        self.send_update = send_update
        self.builder_id = builder_id
    
    async def process_input(self, text: str) -> Dict[str, Any]:
        """
        Process user input and extract bid form fields.
        Single-pass extraction - returns extracted fields immediately.
        
        Args:
            text: Builder's natural language input describing their proposal
            
        Returns:
            Dictionary with extracted fields
        """
        try:
            logger.info(f"[BidAgent] process_input called with text: {text}")
            
            # Clean the input text
            cleaned_text = _clean_text(text)
            logger.info(f"[BidAgent] Cleaned text: {cleaned_text}")
            
            if not cleaned_text:
                logger.warning("[BidAgent] No valid input after cleaning")
                await self.send_update({
                    "type": "bid_form_update",
                    "data": {"status": "error", "error": "No valid input received"}
                })
                return {"error": "No valid input"}
            
            # Send processing status
            logger.info("[BidAgent] Sending processing status...")
            await self.send_update({
                "type": "bid_form_update",
                "data": {"status": "processing", "message": "Extracting bid details..."}
            })
            
            # Use LLM for comprehensive extraction
            logger.info("[BidAgent] Starting LLM extraction...")
            llm_extracted = await _extract_with_llm(cleaned_text)
            logger.info(f"[BidAgent] LLM extracted: {llm_extracted}")
            
            # Also try rule-based extraction for certain fields as fallback
            detected_cost = _extract_cost(cleaned_text)
            detected_duration = _extract_duration(cleaned_text)
            detected_materials = _extract_materials(cleaned_text)
            logger.info(f"[BidAgent] Rule-based: cost={detected_cost}, duration={detected_duration}, materials={detected_materials}")
            
            # Merge results, preferring LLM results but using rule-based as fallback
            extracted_data = {
                "proposal_title": llm_extracted.get("proposal_title"),
                "proposal_details": llm_extracted.get("proposal_details"),
                "estimated_cost": llm_extracted.get("estimated_cost") or detected_cost,
                "estimated_duration": llm_extracted.get("estimated_duration") or detected_duration,
                "approach": llm_extracted.get("approach"),
                "materials": llm_extracted.get("materials") or detected_materials if detected_materials else None,
            }
            
            # Filter out None values
            extracted_data = {k: v for k, v in extracted_data.items() if v is not None}
            logger.info(f"[BidAgent] Final extracted data: {extracted_data}")
            
            # Send the extracted data
            await self.send_update({
                "type": "bid_form_update",
                "data": {
                    "status": "complete",
                    "extracted_fields": extracted_data,
                    "message": f"Extracted {len(extracted_data)} fields"
                }
            })
            logger.info("[BidAgent] Sent complete update to client")
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"Error in bid form extraction: {e}")
            await self.send_update({
                "type": "bid_form_update",
                "data": {"status": "error", "error": str(e)}
            })
            return {"error": str(e)}


async def handle_bid_form_extract(
    send_update: Callable[[Dict[str, Any]], Awaitable[None]],
    builder_id: str,
    message: str
) -> Dict[str, Any]:
    """
    Handler function for bid form extraction via WebSocket.
    
    Args:
        send_update: Async callback to send updates to client
        builder_id: The builder's ID
        message: The builder's natural language input
        
    Returns:
        Dictionary with extracted fields
    """
    agent = BidFormExtractionAgent(send_update=send_update, builder_id=builder_id)
    return await agent.process_input(message)
