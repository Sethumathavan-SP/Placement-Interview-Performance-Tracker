import json
import re

try:
    from groq import Groq
except ImportError:
    Groq = None
from sqlalchemy.orm import Session

from app.config import settings
from app.services.pattern_analyzer import analyze_student_patterns


def build_prompt(patterns: dict) -> str:
    failure_details = ""
    for round_type, data in patterns.get("failure_by_round_type", {}).items():
        failure_details += (
            f"  - {round_type}: Failed {data['count']} time(s) "
            f"at companies: {', '.join(data['drives'])}\n"
        )

    weakness_details = ""
    for area, count in patterns.get("weakness_areas", {}).items():
        weakness_details += f"  - {area}: {count} occurrence(s)\n"

    score_info = ""
    if patterns.get("score_trend"):
        scores = patterns["score_trend"]
        score_info = f"Score trend across failed rounds: {scores} ({patterns['failure_trend']})"

    strengths = ", ".join(patterns.get("always_clears", [])) or "None identified"

    return f"""You are a placement intervention advisor for an engineering college.

Analyze this student's placement failure data and generate a personalized intervention plan.

STUDENT PROFILE:
- Name: {patterns['student_name']}
- Department: {patterns['department']}
- CGPA: {patterns['cgpa']}
- Drives attempted: {patterns['total_drives_attempted']}
- Drives cleared (got selected): {patterns['total_drives_cleared']}

FAILURE BREAKDOWN BY ROUND TYPE:
{failure_details}
BIGGEST BOTTLENECK: {patterns.get('biggest_bottleneck', 'Unknown')}

IDENTIFIED WEAKNESS AREAS:
{weakness_details}
{score_info}

STRENGTHS (rounds always cleared): {strengths}

Respond in this exact JSON format (no markdown, no extra text):
{{
  "analysis": "A 2-3 sentence analysis of why this student is failing and the root cause pattern",
  "recommendations": [
    {{
      "title": "Short action title",
      "description": "Detailed description of what the student should do",
      "action_type": "Type of action (e.g., Practice Set, Mock Interview, Mentor Session, Workshop, Resource, Counseling)",
      "target_weakness": "Which weakness this addresses",
      "priority_order": 1,
      "estimated_days": 14,
      "resources": ["specific resource URLs or names"]
    }}
  ]
}}

Generate 3-5 specific, actionable recommendations. Be concrete — name specific platforms, topics, and time estimates. Prioritize by impact."""


def parse_groq_response(raw: str) -> dict:
    cleaned = raw.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
    return json.loads(cleaned)


def compute_priority(patterns: dict) -> str:
    total_failures = sum(
        data["count"] for data in patterns.get("failure_by_round_type", {}).values()
    )
    total_attempted = patterns.get("total_drives_attempted", 0)
    total_cleared = patterns.get("total_drives_cleared", 0)

    if total_cleared > 0 and total_failures <= 1:
        return "LOW"
    if total_failures >= 4 or (total_attempted >= 3 and total_cleared == 0):
        return "CRITICAL"
    if total_failures >= 3:
        return "HIGH"
    if total_failures >= 2:
        return "MEDIUM"
    return "LOW"


def generate_intervention(db: Session, student_id: str, coordinator_id: str) -> dict:
    patterns = analyze_student_patterns(db, student_id)

    if patterns["total_drives_attempted"] == 0:
        raise ValueError("Student has no drive attempts to analyze")

    prompt = build_prompt(patterns)

    try:
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000,
        )
    except Exception as e:
        raise RuntimeError(f"Groq API call failed: {e}") from e

    raw_content = response.choices[0].message.content
    try:
        parsed = parse_groq_response(raw_content)
    except (json.JSONDecodeError, KeyError) as e:
        raise RuntimeError(f"Failed to parse Groq response: {e}") from e
    priority = compute_priority(patterns)

    bottleneck = patterns.get("biggest_bottleneck", "Unknown")
    top_weakness = ""
    if patterns.get("weakness_areas"):
        top_weakness = max(patterns["weakness_areas"], key=patterns["weakness_areas"].get)

    trigger_reason = (
        f"Failed {bottleneck} round in "
        f"{patterns['failure_by_round_type'].get(bottleneck, {}).get('count', 0)} drives"
    )
    if top_weakness:
        trigger_reason += f" — primary weakness: {top_weakness}"

    return {
        "student_id": student_id,
        "coordinator_id": coordinator_id,
        "trigger_reason": trigger_reason,
        "failure_summary": patterns,
        "ai_analysis": parsed["analysis"],
        "recommendations": parsed["recommendations"],
        "priority": priority,
    }
