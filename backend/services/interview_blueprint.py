import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from backend.utils.logging import logger

class InterviewBlueprint(BaseModel):
    competencies_to_probe: List[str] = Field(default_factory=list, description="Target technical and behavioral competencies to assess")
    resume_hooks: List[str] = Field(default_factory=list, description="Specific claimed achievements, projects, or technologies to verify")
    level_calibration: str = Field(default="", description="Calibrated seniority expectations and depth of answers expected")
    scenario_ideas: List[str] = Field(default_factory=list, description="Realistic practical scenarios and engineering challenges to explore")
    red_flags_to_check: List[str] = Field(default_factory=list, description="Potential gaps, inflated claims, or warning signs to probe")

def get_minimal_fallback_blueprint(
    role: str = "Software Engineer",
    level: str = "Mid-Level",
    interview_type: str = "Technical & Coding",
    resume_profile: Optional[Dict[str, Any]] = None,
    jd_text: Optional[str] = None
) -> InterviewBlueprint:
    """Generates a rich, rule-based blueprint calibrated specifically to role and seniority level."""
    lvl_lower = (level or "").lower()
    role_clean = role or "Software Engineer"
    skills = (resume_profile or {}).get("skills", [])
    projects = (resume_profile or {}).get("projects", [])

    is_senior = any(s in lvl_lower for s in ["senior", "lead", "staff", "principal", "5-8", "8+"])
    is_junior = any(s in lvl_lower for s in ["fresher", "junior", "college", "graduate", "entry", "intern", "1-2"])

    if is_senior:
        level_calibration = (
            f"SENIOR / STAFF LEVEL CALIBRATION for {role_clean}:\n"
            f"- Evaluate system-level architectural intuition, trade-off analysis under high throughput, and fault tolerance boundaries.\n"
            f"- Look for deep understanding of concurrency, data consistency, caching invalidation, failure recovery, and distributed bottlenecks.\n"
            f"- Expect nuanced, decisive explanations of why specific technologies or patterns were selected over alternatives.\n"
            f"- Assess technical leadership, architectural mentoring, incident post-mortems, and production blast radius management."
        )
        competencies = [
            "distributed_architecture_and_scalability",
            "system_tradeoffs_and_cost_efficiency",
            "production_reliability_and_incident_handling",
            "data_consistency_and_concurrency_control",
            "technical_leadership_and_code_standards"
        ]
        scenarios = [
            f"Handling a 10x traffic spike on the core services of a {role_clean} pipeline.",
            "Diagnosing and mitigating an intermittent race condition or memory leak in production.",
            "Architecting a zero-downtime database schema migration on high-velocity tables."
        ]
    elif is_junior:
        level_calibration = (
            f"JUNIOR / FRESHER LEVEL CALIBRATION for {role_clean}:\n"
            f"- Evaluate foundational programming mechanics, clean syntax, control flow, and data structures.\n"
            f"- Assess practical understanding of basic APIs, database queries, error handling, and coursework/personal projects.\n"
            f"- Probe willingness to learn, receptiveness to feedback, debugging approach, and code cleanliness.\n"
            f"- Do not expect deep mastery of multi-region distributed systems; focus on hands-on fundamentals."
        )
        competencies = [
            "core_programming_fundamentals",
            "basic_api_design_and_data_flow",
            "debugging_and_unit_testing",
            "project_ownership_and_git_workflow",
            "problem_solving_and_receptiveness"
        ]
        scenarios = [
            f"Building and testing a RESTful endpoint for a {role_clean} feature.",
            "Tracing and fixing a null pointer or boundary error reported in user logs.",
            "Designing a simple relational database table with foreign keys and validations."
        ]
    else: # Mid-level
        level_calibration = (
            f"MID-LEVEL PROFESSIONAL CALIBRATION for {role_clean}:\n"
            f"- Evaluate end-to-end feature ownership from requirements to testing and deployment.\n"
            f"- Assess solid API design, asynchronous processing, query optimization, and component lifecycle.\n"
            f"- Look for pragmatic problem-solving, structured testing (unit & integration), and production observability.\n"
            f"- Expect clear explanations of trade-offs made in past production implementations."
        )
        competencies = [
            "feature_implementation_and_clean_code",
            "api_design_and_asynchronous_workflows",
            "database_modeling_and_query_performance",
            "automated_testing_and_ci_cd",
            "collaborative_debugging_and_monitoring"
        ]
        scenarios = [
            f"Implementing a background asynchronous job queue for a {role_clean} feature.",
            "Refactoring a monolithic module into decoupled services with clear contracts.",
            "Adding observability, telemetry metrics, and structured logging to an endpoint."
        ]

    hooks = []
    if skills:
        hooks.append(f"Probe concrete production use of claimed skills: {', '.join(skills[:5])}")
    if projects:
        hooks.append(f"Deep-dive into architectural implementation of project: {projects[0]}")
    if not hooks:
        hooks.append(f"Investigate recent engineering implementations relevant to {role_clean}")

    red_flags = [
        "Inability to explain the internals or edge cases of claimed resume technologies",
        "Vague answers about personal contribution vs. team contribution on listed projects",
        "Claiming senior responsibility without awareness of trade-offs, testing, or failure modes"
    ]

    return InterviewBlueprint(
        competencies_to_probe=competencies,
        resume_hooks=hooks,
        level_calibration=level_calibration,
        scenario_ideas=scenarios,
        red_flags_to_check=red_flags
    )

async def generate_interview_blueprint(
    role: str = "Software Engineer",
    level: str = "Mid-Level",
    interview_type: str = "Technical & Coding",
    resume_profile: Optional[Dict[str, Any]] = None,
    jd_text: Optional[str] = None
) -> InterviewBlueprint:
    """
    Calls Gemini to generate a tailored interview blueprint based on role, level, resume, and JD.
    Falls back gracefully to get_minimal_fallback_blueprint on failure or when key is absent.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_valid_key = bool(api_key and len(api_key) > 10 and not api_key.startswith("your_"))
    
    if not is_valid_key:
        logger.info("[BLUEPRINT] No valid GEMINI_API_KEY, using rule-calibrated fallback blueprint.")
        return get_minimal_fallback_blueprint(role, level, interview_type, resume_profile, jd_text)

    skills = (resume_profile or {}).get("skills", [])
    projects = (resume_profile or {}).get("projects", [])
    summary = (resume_profile or {}).get("summary", "")

    prompt = f"""
Generate an interview evaluation blueprint for the following candidate profile:
Role: {role}
Seniority Level: {level}
Interview Type: {interview_type}
Job Description / Focus: {jd_text or "General industry standard for this position"}
Resume Summary: {summary}
Resume Skills: {', '.join(skills[:12]) if skills else 'Not specified'}
Resume Projects: {', '.join(projects[:4]) if projects else 'Not specified'}

Return STRICT JSON matching this schema:
{{
  "competencies_to_probe": ["string (e.g. system_architecture, concurrency, database_indexing)"],
  "resume_hooks": ["string (specific technology/project to probe from their profile)"],
  "level_calibration": "string (explicit criteria differentiating expectations for {level} level)",
  "scenario_ideas": ["string (practical engineering scenario or system problem to present)"],
  "red_flags_to_check": ["string (potential inconsistencies, surface-level knowledge, or red flags)"]
}}
Do NOT generate static interview questions. Generate evaluation dimensions, calibration guidelines, and scenario topics.
"""
    client = genai.Client(api_key=api_key)
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            raw_text = (response.text or "").strip()
            data = json.loads(raw_text)
            blueprint = InterviewBlueprint(**data)
            logger.info(f"[BLUEPRINT] Successfully generated blueprint for {role} ({level})")
            return blueprint
        except Exception as e:
            logger.warning(f"[BLUEPRINT] Blueprint generation attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(0.5)

    return get_minimal_fallback_blueprint(role, level, interview_type, resume_profile, jd_text)

def format_blueprint_for_prompt(blueprint: InterviewBlueprint) -> str:
    """Formats blueprint into prompt guidance without including static question lists."""
    competencies_str = "\n".join(f"- {c}" for c in blueprint.competencies_to_probe)
    hooks_str = "\n".join(f"- {h}" for h in blueprint.resume_hooks)
    scenarios_str = "\n".join(f"- {s}" for s in blueprint.scenario_ideas)
    red_flags_str = "\n".join(f"- {r}" for r in blueprint.red_flags_to_check)

    return (
        f"\n### INTERVIEW BLUEPRINT & LEVEL CALIBRATION:\n"
        f"{blueprint.level_calibration}\n\n"
        f"Key Competency Dimensions to Probe:\n{competencies_str}\n\n"
        f"Verified Candidate Background Hooks:\n{hooks_str}\n\n"
        f"Scenario Contexts for Practical Exploration:\n{scenarios_str}\n\n"
        f"Red Flags & Depth Checks:\n{red_flags_str}\n"
    )
