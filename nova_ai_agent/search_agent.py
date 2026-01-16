"""
SearchAgent - Dedicated agent for web search and URL analysis.

This agent uses Google Search Grounding and URL Context tools to provide
real-time web information. It's designed to be called as a tool by the
main AI agent, solving the incompatibility between built-in tools and
function calling.
"""

from __future__ import annotations

import json
from typing import Optional, List, Dict, Any

from google import genai
from google.genai import types


class SearchAgent:
    """Agent specialized in web search and URL content analysis.
    
    This agent uses Gemini's built-in Google Search Grounding and URL Context
    tools to fetch real-time information from the web. It's designed to be
    invoked as a tool by the main agent, which uses function calling.
    
    The separation into a dedicated agent solves the API limitation where
    Google Search/URL Context cannot be combined with function calling.
    """
    
    def __init__(self, api_key: str, model_name: str = "gemini-3-pro-preview"):
        """Initialize the SearchAgent.
        
        Args:
            api_key: Gemini API key
            model_name: Model to use for search queries (default: gemini-3-pro-preview)
        """
        if not api_key:
            raise ValueError("API key is required for SearchAgent")
        
        self._client = genai.Client(api_key=api_key)
        self._model_name = model_name
        print(f"[SearchAgent] Initialized with model: {model_name}")
    
    def search_web(self, query: str) -> Dict[str, Any]:
        """Search the web using Google Search Grounding.
        
        Makes a Gemini API call with Google Search tool enabled to get
        real-time, grounded information from the web.
        
        Args:
            query: The search query to find current information about
            
        Returns:
            Dictionary containing:
                - success: bool
                - query: Original query
                - answer: Summarized answer from search
                - sources: List of sources with title, url, snippet
                - error: Error message if failed
        """
        try:
            print(f"[SearchAgent] Searching web for: {query[:100]}...")
            
            # Configure with Google Search Grounding
            tools = [types.Tool(google_search=types.GoogleSearch())]
            
            # Create a focused prompt that strictly requires grounded results
            prompt = f"""You are a search assistant that ONLY provides information from Google Search results.

IMPORTANT RULES:
1. You MUST ONLY use information found in the search results
2. Do NOT use any information from your training data or prior knowledge
3. If the search results don't contain the answer, say "No relevant search results found"
4. Always cite the sources you used
5. If information is uncertain or conflicting, state that clearly

Search query: {query}

Respond ONLY with information from the search results. Do not supplement with your own knowledge."""

            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for more factual responses
                    tools=tools
                )
            )
            
            # Extract the response text
            answer = ""
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        answer += part.text
            
            # Extract grounding metadata (sources)
            sources = []
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    metadata = candidate.grounding_metadata
                    
                    # Extract grounding chunks (sources)
                    if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                        for chunk in metadata.grounding_chunks:
                            if hasattr(chunk, 'web') and chunk.web:
                                sources.append({
                                    "title": getattr(chunk.web, 'title', 'Unknown'),
                                    "url": getattr(chunk.web, 'uri', ''),
                                })
                    
                    # Also try search_entry_point if available
                    if hasattr(metadata, 'search_entry_point') and metadata.search_entry_point:
                        if hasattr(metadata.search_entry_point, 'rendered_content'):
                            # This contains rendered HTML for the search widget
                            pass
            
            print(f"[SearchAgent] Search complete. Found {len(sources)} sources.")
            
            return {
                "success": True,
                "query": query,
                "answer": answer,
                "sources": sources,
                "source_count": len(sources)
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"[SearchAgent] Search error: {error_msg}")
            return {
                "success": False,
                "query": query,
                "answer": "",
                "sources": [],
                "error": error_msg
            }
    
    def analyze_url(self, url: str, question: Optional[str] = None) -> Dict[str, Any]:
        """Analyze content from a specific URL.
        
        Uses URL Context tool to fetch and analyze the content of a webpage.
        
        Args:
            url: The URL to analyze
            question: Optional specific question about the content
            
        Returns:
            Dictionary containing:
                - success: bool
                - url: The analyzed URL
                - answer: Analysis or answer about the content
                - error: Error message if failed
        """
        try:
            print(f"[SearchAgent] Analyzing URL: {url[:80]}...")
            
            # Configure with URL Context tool
            tools = [{"url_context": {}}]
            
            # Create prompt that strictly requires using URL content
            if question:
                prompt = f"""You are a URL content analyzer that ONLY provides information from the specified URL.

IMPORTANT RULES:
1. You MUST ONLY use information found in the URL content
2. Do NOT use any information from your training data or prior knowledge
3. If the URL content doesn't contain the answer, say "This information is not found in the URL content"
4. Be specific about what information comes from the URL

URL to analyze: {url}

Question: {question}

Answer this question using ONLY information from the URL content."""
            else:
                prompt = f"""You are a URL content analyzer that ONLY provides information from the specified URL.

IMPORTANT RULES:
1. You MUST ONLY use information found in the URL content
2. Do NOT use any information from your training data or prior knowledge
3. Summarize ONLY what is actually present on the page
4. If the page cannot be accessed, say so clearly

URL to analyze: {url}

Provide a summary using ONLY information from this URL."""

            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for more factual responses
                    tools=tools
                )
            )
            
            # Extract the response text
            answer = ""
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        answer += part.text
            
            # Check for URL context metadata
            url_retrieved = False
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'url_context_metadata') and candidate.url_context_metadata:
                    url_retrieved = True
            
            print(f"[SearchAgent] URL analysis complete. Retrieved: {url_retrieved}")
            
            return {
                "success": True,
                "url": url,
                "answer": answer,
                "url_retrieved": url_retrieved
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"[SearchAgent] URL analysis error: {error_msg}")
            return {
                "success": False,
                "url": url,
                "answer": "",
                "error": error_msg
            }
    
    def search_with_urls(self, query: str, urls: List[str]) -> Dict[str, Any]:
        """Search the web while also analyzing specific URLs.
        
        Combines Google Search Grounding with URL Context for comprehensive
        research that includes both general web search and specific URL analysis.
        
        Args:
            query: The search query
            urls: List of URLs to analyze alongside the search
            
        Returns:
            Combined results from search and URL analysis
        """
        try:
            print(f"[SearchAgent] Combined search: query='{query[:50]}...', urls={len(urls)}")
            
            # Configure with both tools
            tools = [
                types.Tool(google_search=types.GoogleSearch()),
                {"url_context": {}}
            ]
            
            # Create prompt that strictly requires grounded results
            url_list = "\n".join([f"- {url}" for url in urls])
            prompt = f"""You are a research assistant that ONLY provides information from Google Search results and the provided URLs.

IMPORTANT RULES:
1. You MUST ONLY use information found in the search results and URL content
2. Do NOT use any information from your training data or prior knowledge
3. If the search results and URLs don't contain the answer, say "No relevant information found in sources"
4. Always cite which source each piece of information comes from
5. Clearly distinguish between information from search vs. provided URLs

Research topic: {query}

URLs to analyze:
{url_list}

Respond ONLY with information from the search results and URL content. Do not supplement with your own knowledge."""

            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for more factual responses
                    tools=tools
                )
            )
            
            # Extract response
            answer = ""
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        answer += part.text
            
            # Extract sources
            sources = []
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    metadata = candidate.grounding_metadata
                    if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                        for chunk in metadata.grounding_chunks:
                            if hasattr(chunk, 'web') and chunk.web:
                                sources.append({
                                    "title": getattr(chunk.web, 'title', 'Unknown'),
                                    "url": getattr(chunk.web, 'uri', ''),
                                })
            
            print(f"[SearchAgent] Combined search complete. Sources: {len(sources)}")
            
            return {
                "success": True,
                "query": query,
                "urls_analyzed": urls,
                "answer": answer,
                "sources": sources
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"[SearchAgent] Combined search error: {error_msg}")
            return {
                "success": False,
                "query": query,
                "urls_analyzed": urls,
                "answer": "",
                "sources": [],
                "error": error_msg
            }
