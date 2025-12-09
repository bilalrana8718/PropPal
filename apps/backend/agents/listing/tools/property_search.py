"""
Property search tool for the Listing Agent.
Uses a hybrid approach: filter first, then vector search for relevance ranking.
"""
import asyncio
import concurrent.futures
import traceback
from typing import Any, Dict, List, Optional
from langchain_core.tools import tool
from motor.motor_asyncio import AsyncIOMotorClient
from services.embeddings.service import embed_text
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_database_client():
    """Create a fresh database client for each request."""
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        raise ValueError("MONGODB_URL environment variable is required")
    return AsyncIOMotorClient(mongodb_url)


async def _filter_then_search_async(query: str, k: int = 5, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    HYBRID APPROACH: First filter properties, then rank by vector similarity.
    
    This approach ensures that filters are respected while still providing
    relevance ranking via embeddings.
    
    Args:
        query: Search query text
        k: Number of results to return
        filters: Optional dictionary of filters (city, price_min, price_max, bedrooms, etc.)
        
    Returns:
        Dictionary containing search results
    """
    client = None
    try:
        if not query:
            return {"success": True, "query": query, "results": [], "count": 0}
        
        # Get database client and database
        client = get_database_client()
        db = client["proppal"]
        
        # Generate query embedding
        query_vec = embed_text(query)
        
        # Build MongoDB filter query
        mongo_filter = {}
        filter_conditions = []
        
        if filters and isinstance(filters, dict) and len(filters) > 0:
            print(f"[DEBUG] Building filter-first query with filters: {filters}")
            
            # City filter - case insensitive
            if "city" in filters and filters["city"]:
                city_val = filters["city"].strip()
                filter_conditions.append({"city": {"$regex": f"^{city_val}$", "$options": "i"}})
                print(f"[DEBUG] City filter: {city_val}")
            
            # Area filter - partial match
            if "area" in filters and filters["area"]:
                area_val = filters["area"].strip()
                filter_conditions.append({"area": {"$regex": area_val, "$options": "i"}})
                print(f"[DEBUG] Area filter: {area_val}")
            
            # Property type filter
            if "property_type" in filters and filters["property_type"]:
                prop_type = filters["property_type"].strip().lower()
                filter_conditions.append({"property_type": {"$regex": f"^{prop_type}$", "$options": "i"}})
                print(f"[DEBUG] Property type filter: {prop_type}")
            
            # Price filters
            if "price_min" in filters and filters["price_min"] is not None:
                filter_conditions.append({"price": {"$gte": filters["price_min"]}})
                print(f"[DEBUG] Price min filter: {filters['price_min']}")
            if "price_max" in filters and filters["price_max"] is not None:
                filter_conditions.append({"price": {"$lte": filters["price_max"]}})
                print(f"[DEBUG] Price max filter: {filters['price_max']}")
            
            # Bedrooms filters
            if "bedrooms_min" in filters and filters["bedrooms_min"] is not None:
                filter_conditions.append({"bedrooms": {"$gte": filters["bedrooms_min"]}})
            if "bedrooms_max" in filters and filters["bedrooms_max"] is not None:
                filter_conditions.append({"bedrooms": {"$lte": filters["bedrooms_max"]}})
            
            # Bathrooms filters
            if "bathrooms_min" in filters and filters["bathrooms_min"] is not None:
                filter_conditions.append({"bathrooms": {"$gte": filters["bathrooms_min"]}})
            if "bathrooms_max" in filters and filters["bathrooms_max"] is not None:
                filter_conditions.append({"bathrooms": {"$lte": filters["bathrooms_max"]}})
            
            # Area sqft filters
            if "area_sqft_min" in filters and filters["area_sqft_min"] is not None:
                filter_conditions.append({"area_sqft": {"$gte": filters["area_sqft_min"]}})
            if "area_sqft_max" in filters and filters["area_sqft_max"] is not None:
                filter_conditions.append({"area_sqft": {"$lte": filters["area_sqft_max"]}})
            
            if filter_conditions:
                mongo_filter = {"$and": filter_conditions}
        
        # STEP 1: Count how many documents match the filter
        filter_count = await db["properties"].count_documents(mongo_filter if mongo_filter else {})
        print(f"[DEBUG] Documents matching filter: {filter_count}")
        
        # STEP 2: If we have matching documents, use vector search with pre-filter
        # MongoDB Atlas Vector Search supports filter parameter
        if filter_count > 0:
            # Use $vectorSearch with filter (Atlas supports this)
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "properties_embedding_index",
                        "path": "embedding",
                        "queryVector": query_vec,
                        "numCandidates": min(filter_count * 2, 1000),  # Search within filtered set
                        "limit": k * 2,
                        "filter": mongo_filter if mongo_filter else {}
                    }
                },
                {
                    "$project": {
                        "score": {"$meta": "vectorSearchScore"},
                        "title": 1,
                        "price": 1,
                        "city": 1,
                        "area": 1,
                        "property_type": 1,
                        "bedrooms": 1,
                        "bathrooms": 1,
                        "area_sqft": 1,
                        "images": 1,
                        "description": 1,
                    }
                },
                {"$limit": k}
            ]
            
            print(f"[DEBUG] Executing vector search with pre-filter")
            try:
                results = await db["properties"].aggregate(pipeline).to_list(k)
                print(f"[DEBUG] Vector search with filter returned {len(results)} results")
            except Exception as e:
                print(f"[WARNING] Vector search with filter failed: {e}, trying alternative approach")
                # Fallback: Manual filtering + sorting by embedding similarity
                results = await _manual_filter_and_rank(db, query_vec, mongo_filter, k)
        else:
            # No documents match the strict filter - try relaxing filters
            print(f"[WARNING] No properties match filters. Trying with relaxed filters...")
            results = await _search_with_relaxed_filters(db, query_vec, filters, k)
        
        # If still no results, do a pure vector search and inform user
        if len(results) == 0:
            print(f"[WARNING] No results with any filters. Doing pure semantic search...")
            results = await _pure_vector_search(db, query_vec, k)
            if results:
                print(f"[INFO] Found {len(results)} results via pure semantic search (filters too restrictive)")
        
        # Normalize _id for JSON serialization
        for r in results:
            if "_id" in r:
                r["_id"] = str(r["_id"])
        
        print(f"[DEBUG] Final result count: {len(results)}")
        
        return {
            "success": True,
            "query": query,
            "results": results,
            "count": len(results),
            "filters_applied": filters if filters else {},
            "filter_matched_count": filter_count
        }
        
    except Exception as e:
        print(f"[ERROR] Property search failed: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "query": query,
            "results": [],
            "count": 0
        }
    finally:
        if client:
            client.close()


async def _manual_filter_and_rank(db, query_vec: List[float], mongo_filter: Dict, k: int) -> List[Dict]:
    """
    Fallback: Manually filter documents and rank by cosine similarity.
    Used when $vectorSearch with filter fails.
    """
    import numpy as np
    
    # Get filtered documents with embeddings
    cursor = db["properties"].find(
        mongo_filter,
        {
            "embedding": 1, "title": 1, "price": 1, "city": 1, "area": 1,
            "property_type": 1, "bedrooms": 1, "bathrooms": 1, "area_sqft": 1,
            "images": 1, "description": 1
        }
    ).limit(500)  # Limit to prevent memory issues
    
    docs = await cursor.to_list(500)
    
    if not docs:
        return []
    
    # Calculate cosine similarity for each document
    query_vec_np = np.array(query_vec)
    
    for doc in docs:
        if "embedding" in doc and doc["embedding"]:
            doc_vec = np.array(doc["embedding"])
            # Cosine similarity
            similarity = np.dot(query_vec_np, doc_vec) / (np.linalg.norm(query_vec_np) * np.linalg.norm(doc_vec))
            doc["score"] = float(similarity)
        else:
            doc["score"] = 0.0
        # Remove embedding from result
        doc.pop("embedding", None)
    
    # Sort by similarity score (descending)
    docs.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    return docs[:k]


async def _search_with_relaxed_filters(db, query_vec: List[float], filters: Dict, k: int) -> List[Dict]:
    """
    Try searching with progressively relaxed filters.
    Priority: Keep city, relax price, then relax property type.
    """
    relaxed_filters = []
    
    # Try 1: Keep only city filter
    if filters.get("city"):
        relaxed_filters.append({"city": {"$regex": f"^{filters['city']}$", "$options": "i"}})
    
    if not relaxed_filters:
        return []
    
    mongo_filter = {"$and": relaxed_filters} if len(relaxed_filters) > 1 else relaxed_filters[0]
    
    count = await db["properties"].count_documents(mongo_filter)
    print(f"[DEBUG] Relaxed filter (city only) matched {count} documents")
    
    if count > 0:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "properties_embedding_index",
                    "path": "embedding",
                    "queryVector": query_vec,
                    "numCandidates": min(count * 2, 500),
                    "limit": k,
                    "filter": mongo_filter
                }
            },
            {
                "$project": {
                    "score": {"$meta": "vectorSearchScore"},
                    "title": 1, "price": 1, "city": 1, "area": 1,
                    "property_type": 1, "bedrooms": 1, "bathrooms": 1,
                    "area_sqft": 1, "images": 1, "description": 1,
                }
            }
        ]
        
        try:
            results = await db["properties"].aggregate(pipeline).to_list(k)
            print(f"[INFO] Found {len(results)} results with relaxed filters (city only)")
            return results
        except Exception as e:
            print(f"[WARNING] Relaxed filter search failed: {e}")
    
    return []


async def _pure_vector_search(db, query_vec: List[float], k: int) -> List[Dict]:
    """Pure vector search without any filters."""
    pipeline = [
        {
            "$vectorSearch": {
                "index": "properties_embedding_index",
                "path": "embedding",
                "queryVector": query_vec,
                "numCandidates": 200,
                "limit": k,
            }
        },
        {
            "$project": {
                "score": {"$meta": "vectorSearchScore"},
                "title": 1, "price": 1, "city": 1, "area": 1,
                "property_type": 1, "bedrooms": 1, "bathrooms": 1,
                "area_sqft": 1, "images": 1, "description": 1,
            }
        }
    ]
    
    return await db["properties"].aggregate(pipeline).to_list(k)


def _run_async_search(search_coro):
    """Helper to run asyncio code from a sync context (safe in running loops)."""
    try:
        asyncio.get_running_loop()
        # Already in an async context, use thread pool
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, search_coro)
            return future.result()
    except RuntimeError:
        return asyncio.run(search_coro)
    except Exception as e:
        return {"success": False, "error": str(e), "results": [], "count": 0}


def _property_search_impl(query: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Internal implementation of property search using the new filter-first approach.
    """
    search_coro = _filter_then_search_async(query, k=5, filters=filters)
    return _run_async_search(search_coro)


@tool
def property_search_tool(query: str) -> Dict[str, Any]:
    """
    Searches for properties based on a natural language query.
    Automatically extracts filters (city, area, price, bedrooms, property type, etc.) from the query.
    Uses a filter-first approach: filters properties first, then ranks by relevance.
    
    Args:
        query: The user's search query (e.g., "3 bedroom house in Islamabad under 1 crore").
    """
    # Extract filters from the query, but don't fail if extraction fails
    filters = None
    try:
        from .filter_extractor import extract_property_filters
        filters = extract_property_filters(query)
        if not filters:
            print(f"[DEBUG] No filters extracted from query: {query}")
    except Exception as e:
        # If filter extraction fails, continue without filters
        print(f"Property filter extraction failed (continuing without filters): {e}")
        filters = None
    
    return _property_search_impl(query, filters)
