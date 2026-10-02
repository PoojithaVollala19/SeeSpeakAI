import sqlite3
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from backend.repositories.conversation_repository import DB_FILE, normalize_feature_id
from backend.utils.auth_deps import get_current_user_required, get_current_user_optional
from backend.utils.logging import logger

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("")
def get_user_analytics(user: Dict[str, Any] = Depends(get_current_user_required)):
    """
    Returns strict, authenticated user-specific analytics and activity metrics.
    Zero global or leaked state: all metrics are filtered by WHERE user_id = authenticated_user.id.
    """
    user_id = user["id"]
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Total conversations for this user
        cursor.execute("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?", (user_id,))
        total_conversations = cursor.fetchone()["count"]

        # 2. Total messages in this user's conversations
        cursor.execute(
            """
            SELECT COUNT(m.id) as count 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = ?
            """,
            (user_id,)
        )
        total_messages = cursor.fetchone()["count"]

        # 3. Total files uploaded by this user
        cursor.execute(
            """
            SELECT COUNT(f.id) as count 
            FROM conversation_files f
            JOIN conversations c ON f.conversation_id = c.id
            WHERE c.user_id = ?
            """,
            (user_id,)
        )
        total_files = cursor.fetchone()["count"]

        # 4. Total interview sessions for this user
        cursor.execute("SELECT COUNT(*) as count FROM interview_sessions WHERE user_id = ?", (user_id,))
        total_interviews = cursor.fetchone()["count"]

        # 5. Completed interviews and score aggregations
        cursor.execute(
            """
            SELECT id, interview_type, language, duration_seconds, status, evaluation, created_at
            FROM interview_sessions 
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        interview_rows = cursor.fetchall()

        completed_interviews = 0
        total_score_sum = 0
        total_duration_sum = 0
        competency_totals = {"communication": 0, "technical": 0, "problem_solving": 0, "confidence": 0}
        competency_counts = {"communication": 0, "technical": 0, "problem_solving": 0, "confidence": 0}
        recent_interviews = []

        for r in interview_rows:
            inv = dict(r)
            eval_data = {}
            if inv.get("evaluation"):
                try:
                    eval_data = json.loads(inv["evaluation"])
                except Exception:
                    eval_data = {}

            scores = eval_data.get("scores") or eval_data.get("performance_metrics") or {}
            overall = eval_data.get("overall_score") or scores.get("overall_score") or scores.get("overall") or 0
            if isinstance(overall, (int, float)) and overall > 0:
                total_score_sum += overall
                completed_interviews += 1
                total_duration_sum += (inv.get("duration_seconds") or 0)

                for comp, key_variants in [
                    ("communication", ["communication_clarity", "communication", "clarity"]),
                    ("technical", ["technical_depth", "technical_accuracy", "technical"]),
                    ("problem_solving", ["problem_solving", "structuring"]),
                    ("confidence", ["confidence_delivery", "confidence"])
                ]:
                    for kv in key_variants:
                        if kv in scores and isinstance(scores[kv], (int, float)):
                            competency_totals[comp] += scores[kv]
                            competency_counts[comp] += 1
                            break

            recent_interviews.append({
                "id": inv["id"],
                "role": inv["interview_type"],
                "language": inv["language"],
                "status": inv["status"],
                "duration_seconds": inv.get("duration_seconds", 0),
                "overall_score": overall,
                "created_at": inv["created_at"]
            })

        avg_interview_score = round(total_score_sum / max(1, completed_interviews), 1) if completed_interviews > 0 else 0
        avg_interview_duration = round(total_duration_sum / max(1, completed_interviews)) if completed_interviews > 0 else 0

        radar_competencies = {
            comp: round(competency_totals[comp] / max(1, competency_counts[comp]), 1) if competency_counts[comp] > 0 else 0
            for comp in competency_totals
        }

        # 6. Support Tickets for this user
        cursor.execute(
            """
            SELECT id, ticket_number, subject, category, priority, status, created_at, resolved_at
            FROM support_tickets
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        ticket_rows = cursor.fetchall()
        total_tickets = len(ticket_rows)
        open_tickets = sum(1 for t in ticket_rows if t["status"] in ["Open", "In Progress", "Waiting for Customer"])
        resolved_tickets = sum(1 for t in ticket_rows if t["status"] in ["Resolved", "Closed"])

        recent_tickets = [
            {
                "id": t["id"],
                "ticket_number": t["ticket_number"],
                "subject": t["subject"],
                "category": t["category"],
                "priority": t["priority"],
                "status": t["status"],
                "created_at": t["created_at"]
            }
            for t in ticket_rows[:10]
        ]

        # 7. Breakdown by workspace feature
        cursor.execute(
            """
            SELECT feature, COUNT(*) as count 
            FROM conversations 
            WHERE user_id = ?
            GROUP BY feature
            """,
            (user_id,)
        )
        feature_counts = {r["feature"]: r["count"] for r in cursor.fetchall()}
        
        known_features = [
            "document-analysis",
            "visual-intelligence",
            "ai-interview",
            "customer-support",
            "video-audio-review",
            "data-study"
        ]

        feature_distribution = [
            {
                "feature_id": fid,
                "count": feature_counts.get(fid, 0)
            }
            for fid in known_features
        ]

        # 8. Activity feed (recent actions by this user)
        cursor.execute(
            """
            SELECT id, title, feature, updated_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC
            LIMIT 10
            """,
            (user_id,)
        )
        recent_conversations = [
            {
                "id": r["id"],
                "title": r["title"],
                "feature": normalize_feature_id(r["feature"]),
                "timestamp": r["updated_at"]
            }
            for r in cursor.fetchall()
        ]

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            },
            "overview": {
                "total_conversations": total_conversations,
                "total_messages": total_messages,
                "total_files": total_files,
                "total_interviews": total_interviews,
                "total_tickets": total_tickets
            },
            "interviews": {
                "total_interviews": total_interviews,
                "completed_interviews": completed_interviews,
                "average_score": avg_interview_score,
                "average_duration_seconds": avg_interview_duration,
                "competency_breakdown": radar_competencies,
                "recent": recent_interviews[:8]
            },
            "support": {
                "total_tickets": total_tickets,
                "open_tickets": open_tickets,
                "resolved_tickets": resolved_tickets,
                "recent": recent_tickets
            },
            "feature_distribution": feature_distribution,
            "recent_activity": recent_conversations
        }
    finally:
        conn.close()

@router.get("/activity")
def get_user_activity(user: Dict[str, Any] = Depends(get_current_user_required)):
    """Convenience alias for personal user activity feed."""
    analytics = get_user_analytics(user)
    return {
        "success": True,
        "activity": analytics.get("recent_activity", [])
    }
