import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from backend.utils.logging import logger

COMMON_TECH_SKILLS = [
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "c", "go", "golang", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "dart", "html", "css", "sql", "bash", "shell",
    # Frameworks & Libraries
    "react", "react.js", "next.js", "vue", "vue.js", "angular", "node", "node.js", "express",
    "fastapi", "django", "flask", "spring", "spring boot", "asp.net", ".net", "flutter",
    "tailwind", "bootstrap", "redux", "graphql", "rest", "restful api",
    # Data & AI / ML
    "machine learning", "deep learning", "ai", "artificial intelligence", "nlp", "computer vision",
    "pytorch", "tensorflow", "keras", "scikit-learn", "pandas", "numpy", "opencv", "llm", "rag",
    # Databases & Caches
    "postgresql", "postgres", "mysql", "mongodb", "sqlite", "redis", "elasticsearch", "cassandra",
    "dynamodb", "mariadb", "firebase", "supabase", "oracle",
    # DevOps & Cloud
    "docker", "kubernetes", "aws", "azure", "gcp", "google cloud", "ci/cd", "git", "github",
    "gitlab", "terraform", "ansible", "jenkins", "linux", "nginx", "kafka", "rabbitmq"
]

DEGREE_KEYWORDS = [
    "bachelor", "master", "phd", "doctorate", "b.tech", "btech", "m.tech", "mtech",
    "b.e", "be", "m.e", "me", "bca", "mca", "b.sc", "bsc", "m.sc", "msc", "diploma",
    "computer science", "information technology", "electrical", "mechanical"
]

class ResumeParser:
    """Extracts structured contextual information from candidate resumes (PDF, DOCX, TXT)."""

    @classmethod
    def parse_file(cls, file_path: str, filename: str) -> Dict[str, Any]:
        """Parses a resume file and extracts structured evidence for interview grounding."""
        ext = os.path.splitext(filename)[1].lower()
        raw_text = ""

        try:
            if ext == ".pdf":
                raw_text = cls._extract_from_pdf(file_path)
            elif ext in [".docx", ".doc"]:
                raw_text = cls._extract_from_docx(file_path)
            elif ext in [".txt", ".md"]:
                raw_text = cls._extract_from_txt(file_path)
            else:
                logger.warning(f"Unsupported resume format: {ext}")
        except Exception as e:
            logger.error(f"Error parsing resume {filename}: {e}")

        clean_text = cls._clean_text(raw_text)
        return cls._analyze_text(clean_text, filename)

    @classmethod
    def parse_text(cls, text: str, filename: str = "resume.txt") -> Dict[str, Any]:
        """Directly parses raw text content."""
        clean_text = cls._clean_text(text)
        return cls._analyze_text(clean_text, filename)

    @classmethod
    def parse_docx_bytes(cls, docx_bytes: bytes, filename: str = "resume.docx") -> Dict[str, Any]:
        """Parses DOCX from bytes."""
        try:
            with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                texts = [
                    node.text
                    for node in tree.iter()
                    if node.tag.endswith("}t") and node.text
                ]
                raw_text = " ".join(texts)
        except Exception as e:
            raw_text = docx_bytes.decode("utf-8", errors="ignore")
        clean_text = cls._clean_text(raw_text)
        return cls._analyze_text(clean_text, filename)

    @classmethod
    def _extract_from_pdf(cls, file_path: str) -> str:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        pages = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                pages.append(t.strip())
        return "\n".join(pages)

    @classmethod
    def _extract_from_docx(cls, file_path: str) -> str:
        # Standard DOCX is an OpenXML ZIP archive
        try:
            with zipfile.ZipFile(file_path) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                texts = [
                    node.text
                    for node in tree.iter()
                    if node.tag.endswith("}t") and node.text
                ]
                return " ".join(texts)
        except Exception as e:
            logger.warning(f"Zip extraction failed for docx, attempting plain text read: {e}")
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

    @classmethod
    def _extract_from_txt(cls, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    @classmethod
    def _clean_text(cls, text: str) -> str:
        # Normalize whitespace while preserving line structure
        text = re.sub(r"\r\n", "\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _analyze_text(cls, text: str, filename: str) -> Dict[str, Any]:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        lower_text = text.lower()

        # 1. Candidate Name detection (usually first non-empty line without 'resume' or 'curriculum')
        candidate_name = ""
        for line in lines[:5]:
            line_clean = re.sub(r"[^a-zA-Z\s]", "", line).strip()
            if 2 <= len(line_clean.split()) <= 4:
                lower_l = line.lower()
                if not any(w in lower_l for w in ["resume", "cv", "curriculum", "page", "contact", "email", "phone"]):
                    candidate_name = line_clean
                    break
        if not candidate_name:
            candidate_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()

        # 2. Extract technical skills
        found_skills: List[str] = []
        for skill in COMMON_TECH_SKILLS:
            # Match whole words to avoid sub-word false positives (e.g. 'c' in 'candidate')
            pattern = r"\b" + re.escape(skill) + r"\b"
            if re.search(pattern, lower_text):
                found_skills.append(skill.title() if len(skill) > 2 else skill.upper())

        # Deduplicate while preserving order
        unique_skills = list(dict.fromkeys(found_skills))

        # 3. Extract Education clues
        education_items: List[str] = []
        for line in lines:
            ll = line.lower()
            if any(deg in ll for deg in DEGREE_KEYWORDS) and len(line) < 120:
                education_items.append(line)
        education_summary = "; ".join(education_items[:3]) if education_items else "Relevant Higher Education"

        # 4. Extract Project and Experience references
        projects: List[str] = []
        project_heading = False
        for line in lines:
            ll = line.lower()
            if any(h in ll for h in ["projects", "personal projects", "academic projects", "key projects"]):
                project_heading = True
                continue
            if project_heading and any(h in ll for h in ["experience", "work history", "skills", "education"]):
                project_heading = False
                continue
            if project_heading and len(line) > 5 and len(line) < 100:
                if re.match(r"^[-*•\d.]", line) or ":" in line:
                    clean_proj = re.sub(r"^[-*•\d.\s]+", "", line).split(":")[0].strip()
                    if clean_proj and len(clean_proj) > 3:
                        projects.append(clean_proj)

        # 5. Extract Years of Experience mentions
        exp_match = re.search(r"(\d+[\+]?)\s+(?:years?|yrs?)(?:\s+of)?\s+experience", lower_text)
        claimed_experience = exp_match.group(0).title() if exp_match else ""

        # 6. Concise Structured Summary
        summary_lines = []
        summary_lines.append(f"Candidate Name: {candidate_name}")
        if claimed_experience:
            summary_lines.append(f"Experience: {claimed_experience}")
        summary_lines.append(f"Education: {education_summary}")
        if unique_skills:
            summary_lines.append(f"Skills: {', '.join(unique_skills[:12])}")
        if projects:
            summary_lines.append(f"Highlighted Projects: {', '.join(projects[:4])}")

        structured_summary = "\n".join(summary_lines)

        # Truncate raw snippet to 3500 chars to avoid prompt bloat while giving rich context
        text_snippet = text[:3500]

        return {
            "candidate_name": candidate_name,
            "filename": filename,
            "skills": unique_skills,
            "projects": projects[:6],
            "experience": claimed_experience,
            "education": education_summary,
            "summary": structured_summary,
            "text_snippet": text_snippet,
            "char_count": len(text)
        }

def format_resume_context_for_prompt(resume_data: Optional[Dict[str, Any]]) -> str:
    """Formats parsed resume into a grounded contextual section for the system prompt."""
    if not resume_data:
        return "No resume uploaded. Calibrate questions dynamically from candidate answers and role."

    name = resume_data.get("candidate_name") or "Candidate"
    skills = resume_data.get("skills") or []
    projects = resume_data.get("projects") or []
    exp = resume_data.get("experience") or "Not explicitly stated"
    education = resume_data.get("education") or "Not specified"
    summary = resume_data.get("summary") or ""
    snippet = resume_data.get("text_snippet") or ""

    skills_str = ", ".join(skills[:15]) if skills else "General technical skills"
    projects_str = ", ".join(projects[:5]) if projects else "Projects mentioned in conversation"

    return (
        f"CANDIDATE NAME: {name}\n"
        f"CLAIMED EXPERIENCE: {exp}\n"
        f"EDUCATION: {education}\n"
        f"IDENTIFIED SKILLS & TECHNOLOGIES: {skills_str}\n"
        f"PROJECTS / EXPERIENCES: {projects_str}\n"
        f"RESUME PROFILE SUMMARY:\n{summary}\n\n"
        f"EXTRACTED RESUME EXCERPT (CONTEXT EVIDENCE ONLY - PROBE NATURALLY, DO NOT ASSUME ABSOLUTE MASTERY):\n"
        f"{snippet[:2000]}"
    )

resume_parser = ResumeParser()
