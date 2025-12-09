"""
Test script for natural language date parsing issues
"""
from datetime import datetime
from agents.booking.tools.booking_tools import parse_natural_language_dates_tool
import json

# Current time is Monday, December 8, 2025, 19:45:16+05:00
base_date = datetime(2025, 12, 8, 19, 45, 16)

print(f"Base date (current time): {base_date.strftime('%A, %B %d, %Y at %I:%M:%S %p')}")
print(f"Tomorrow should be: Tuesday, December 9, 2025\n")
print("="*80)

# Test cases from the user's report
test_cases = [
    "tomorrow at 3pm",
    "Thursday at 4:30pm",
    "all day tomorrow",
    "Tuesday 3pm",
    "Tuesday at 3pm",
    "I want to book a visit at Tuesday 3pm",
]

for test in test_cases:
    print(f"\nTest: '{test}'")
    result = parse_natural_language_dates_tool.invoke({"text": test})
    print(f"Success: {result.get('success')}")
    print(f"Parsed dates: {result.get('parsed_dates')}")
    print(f"Readable: {result.get('readable')}")
    if not result.get('success'):
        print(f"Error: {result.get('error')}")
    print("-"*80)
