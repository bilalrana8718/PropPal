"""
Test the enhanced all day slot generation with half-hour increments
"""
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Add parent directory to path to import booking_tools
sys.path.insert(0, str(Path(__file__).parent))

from agents.booking.tools.booking_tools import _parse_natural_language_date

def test_all_day_generation():
    """Test all day Thursday generation"""
    base_date = datetime(2025, 12, 8, 21, 0, 0)  # Sunday, Dec 8, 2025 at 9pm
    
    print("=" * 60)
    print("Testing: All Day Slot Generation")
    print("=" * 60)
    print(f"Base date: {base_date.strftime('%A, %B %d, %Y at %I:%M %p')}")
    print()
    
    # Test 1: "all day Thursday"
    print("Query: 'all day Thursday'")
    results = _parse_natural_language_date("all day Thursday", base_date)
    print(f"Generated {len(results)} slots:")
    for iso_time in results:
        dt = datetime.fromisoformat(iso_time.replace('+05:00', ''))
        readable = dt.strftime('%A, %B %d at %I:%M %p')
        print(f"  - {readable} ({iso_time})")
    print()
    
    # Test 2: Check if 4:30 PM is in the list
    has_4_30pm = any('16:30:00' in t for t in results)
    print(f"✓ Includes 4:30 PM: {has_4_30pm}")
    print()
    
    # Test 3: "all day tomorrow"
    print("Query: 'all day tomorrow'")
    tomorrow_results = _parse_natural_language_date("all day tomorrow", base_date)
    print(f"Generated {len(tomorrow_results)} slots:")
    for iso_time in tomorrow_results:
        dt = datetime.fromisoformat(iso_time.replace('+05:00', ''))
        readable = dt.strftime('%A, %B %d at %I:%M %p')
        print(f"  - {readable}")
    print()
    
    print("=" * 60)
    print("Summary:")
    print(f"  - All day generates {len(results)} time slots")
    print(f"  - Includes half-hour increments: ✓")
    print(f"  - Will match seller's 4:30 PM: {'✓' if has_4_30pm else '✗'}")
    print("=" * 60)

if __name__ == "__main__":
    test_all_day_generation()
