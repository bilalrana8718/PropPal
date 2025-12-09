"""
Comprehensive test script for booking agent natural language parsing.
Tests single slots, multiple slots, before/after, all day, and various edge cases.
"""
from datetime import datetime
from agents.booking.tools.booking_tools import parse_natural_language_dates_tool
import json

# Current time: Monday, December 8, 2025, 19:53:06+05:00
base_date = datetime(2025, 12, 8, 19, 53, 6)

print("="*80)
print("BOOKING AGENT NATURAL LANGUAGE PARSING TEST SUITE")
print("="*80)
print(f"Base date (current time): {base_date.strftime('%A, %B %d, %Y at %I:%M:%S %p')}")
print(f"Tomorrow should be: Tuesday, December 9, 2025")
print(f"Thursday should be: Thursday, December 11, 2025")
print("="*80)

test_cases = [
    {
        "category": "Single Time Slot",
        "tests": [
            "tomorrow at 3pm",
            "Thursday at 4:30pm",
            "Tuesday 3pm",
            "Tuesday at 3pm",
            "I want to book a visit at Tuesday 3pm",
        ]
    },
    {
        "category": "Multiple Time Slots",
        "tests": [
            "Tuesday 3pm or Thursday 5pm",
            "tomorrow at 3pm or Thursday at 4:30pm",
            "Monday 11am, Tuesday 3pm, and Wednesday 2pm",
            "Tuesday 3pm and Thursday 4:30pm",
        ]
    },
    {
        "category": "All Day Expressions",
        "tests": [
            "all day tomorrow",
            "all day Tuesday",
            "all day Thursday",
        ]
    },
    {
        "category": "Before/After Time",
        "tests": [
            "after 3pm tomorrow",
            "before 5pm tomorrow",
            "after 2pm Thursday",
        ]
    },
    {
        "category": "Complex Queries",
        "tests": [
            "I'm available tomorrow at 3pm for property 123",
            "Can I come Thursday at 4:30pm?",
            "I'm free Tuesday 3pm or Thursday 4:30pm",
        ]
    }
]

for category_info in test_cases:
    category = category_info["category"]
    tests = category_info["tests"]
    
    print(f"\n{'='*80}")
    print(f"CATEGORY: {category}")
    print(f"{'='*80}\n")
    
    for test in tests:
        print(f"Input: \"{test}\"")
        result = parse_natural_language_dates_tool.invoke({"text": test})
        
        if result.get('success'):
            parsed_dates = result.get('parsed_dates', [])
            readable = result.get('readable', [])
            
            print(f"  ✓ Success")
            print(f"  Parsed {len(parsed_dates)} slot(s):")
            for i, (iso, read) in enumerate(zip(parsed_dates, readable), 1):
                print(f"    {i}. {read}")
                print(f"       ISO: {iso}")
        else:
            print(f"  ✗ Failed: {result.get('error')}")
        
        print("-"*80)

print(f"\n{'='*80}")
print("TEST SUITE COMPLETE")
print("="*80)
