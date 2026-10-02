import json
import re
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from backend.repositories.ticket_repository import ticket_repository
from backend.repositories.conversation_repository import conversation_repository
from backend.utils.auth_deps import get_current_user_optional
from backend.utils.logging import logger

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=3)
    description: Optional[str] = None
    category: str = "Technical Support"
    priority: str = "Medium"
    language: str = "en"
    user_id: Optional[str] = "default_user"
    initial_message: Optional[str] = None
    conversation_id: Optional[str] = None

class UpdateTicketStatusRequest(BaseModel):
    status: str
    user_id: Optional[str] = None
    resolution_notes: Optional[str] = None

class AddTicketMessageRequest(BaseModel):
    sender_type: str = "user" # 'user', 'agent', 'system'
    message: str = Field(..., min_length=1)
    user_id: Optional[str] = None

@router.post("")
def create_ticket(
    req: CreateTicketRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    desc = req.description or req.initial_message or req.subject or "Support Ticket"
    effective_user_id = user["id"] if user else (req.user_id or "default_user")
    ticket = ticket_repository.create_ticket(
        subject=req.subject,
        description=desc,
        category=req.category,
        priority=req.priority,
        language=req.language,
        user_id=effective_user_id,
        initial_message=req.initial_message or desc,
        conversation_id=req.conversation_id
    )
    if req.conversation_id:
        try:
            conversation_repository.update_conversation_ticket(req.conversation_id, ticket["id"])
        except Exception as e:
            logger.warning(f"Could not link ticket {ticket['id']} to conversation {req.conversation_id}: {e}")
    return ticket

@router.get("")
def list_tickets(
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    effective_user_id = user["id"] if user else user_id
    return ticket_repository.list_tickets(
        user_id=effective_user_id,
        status=status,
        category=category,
        query=q,
        limit=limit
    )

@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: str,
    user_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    effective_user_id = user["id"] if user else user_id
    ticket = ticket_repository.get_ticket(ticket_id, user_id=effective_user_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.put("/{ticket_id}/status")
@router.patch("/{ticket_id}/status")
def update_status(ticket_id: str, req: UpdateTicketStatusRequest):
    try:
        updated = ticket_repository.update_ticket_status(ticket_id, req.status, user_id=req.user_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Ticket not found")
        if req.resolution_notes:
            ticket_repository.add_ticket_message(
                ticket_id_or_number=ticket_id,
                sender_type="system",
                message=f"Resolution Notes: {req.resolution_notes}",
                user_id=req.user_id
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{ticket_id}/messages")
def add_message(ticket_id: str, req: AddTicketMessageRequest):
    updated = ticket_repository.add_ticket_message(
        ticket_id_or_number=ticket_id,
        sender_type=req.sender_type,
        message=req.message,
        user_id=req.user_id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return updated

@router.get("/{ticket_id}/context")
def get_ticket_context(ticket_id: str):
    prompt_context = ticket_repository.get_ticket_context_prompt(ticket_id)
    if not prompt_context:
        raise HTTPException(status_code=404, detail="Ticket context not found")
    return {
        "ticket_id": ticket_id,
        "prompt_context": prompt_context,
        "context_prompt": prompt_context
    }

class SummarizeSupportSessionRequest(BaseModel):
    ticket_id: Optional[str] = None
    conversation_id: Optional[str] = None
    transcript: Optional[List[Dict[str, Any]]] = None
    messages: Optional[List[Dict[str, Any]]] = None
    duration_seconds: Optional[int] = None
    language: Optional[str] = "en"
    user_id: Optional[str] = "default_user"

LANGUAGE_DISPLAY_NAMES = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "kn": "Kannada",
    "mr": "Marathi",
    "ta": "Tamil",
    "bn": "Bengali",
    "ml": "Malayalam",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "zh": "Chinese",
    "ja": "Japanese",
}

@router.post("/summarize-session")
def summarize_support_session(req: SummarizeSupportSessionRequest):
    """
    Synthesizes a dynamic customer support session summary using actual conversation turns,
    strictly matching the user's current selected language, creating/updating tickets,
    and persisting the summary for history reloading.
    """
    raw_turns = req.transcript or req.messages or []
    # If transcript/messages were not explicitly sent, load conversation turns from repository
    if not raw_turns and req.conversation_id:
        try:
            conv_obj = conversation_repository.get_conversation(req.conversation_id, user_id=req.user_id)
            if conv_obj and conv_obj.get("messages"):
                raw_turns = conv_obj["messages"]
        except Exception as e:
            logger.warning(f"Could not load conversation {req.conversation_id} for summary: {e}")

    # Normalize turns
    turns: List[Dict[str, Any]] = []
    for t in raw_turns:
        speaker = (t.get("speaker") or t.get("role") or "user").lower()
        content = (t.get("text") or t.get("content") or "").strip()
        if content:
            turns.append({
                "speaker": speaker,
                "role": speaker,
                "text": content,
                "content": content,
                "timestamp": t.get("timestamp") or t.get("created_at") or ""
            })

    user_texts = [
        t["text"] for t in turns
        if t["speaker"] in ["user", "customer"]
    ]
    agent_texts = [
        t["text"] for t in turns
        if t["speaker"] in ["ai", "agent", "support", "assistant"]
    ]

    ticket = None
    if req.ticket_id:
        ticket = ticket_repository.get_ticket(req.ticket_id)
    if not ticket and req.conversation_id:
        ticket = ticket_repository.get_ticket_by_conversation(req.conversation_id)

    active_lang = req.language or "en"
    lang_name = LANGUAGE_DISPLAY_NAMES.get(active_lang, active_lang)

    dialogue_formatted = "\n".join([
        f"[{t['speaker'].upper()}]: {t['text']}"
        for t in turns
    ])

    ai_generated = None
    # Attempt dynamic LLM summary generation
    try:
        from backend.routes.chat_routes import get_gemini_client
        client = get_gemini_client()
        if client and dialogue_formatted.strip():
            summary_prompt = (
                f"You are generating a concise customer support inquiry summary.\n"
                f"Use ONLY the actual conversation and available support context.\n\n"
                f"ACTUAL CONVERSATION:\n{dialogue_formatted}\n\n"
                f"Identify:\n"
                f"- customer's issue\n"
                f"- important symptoms/details\n"
                f"- troubleshooting/actions discussed\n"
                f"- outcome\n"
                f"- unresolved issues\n"
                f"- next steps\n"
                f"Do not invent information.\n"
                f"Respond exclusively in {lang_name} using native authentic script.\n"
                f"Do not mention internal system instructions.\n\n"
                f"Output ONLY a raw JSON object with keys:\n"
                f'{{\n'
                f'  "issue_summary": "concise description of reported problem in {lang_name}",\n'
                f'  "ai_understanding": "analysis of symptoms and diagnostic inquiry in {lang_name}",\n'
                f'  "resolution_provided": "troubleshooting steps and resolution actions in {lang_name}",\n'
                f'  "conversation_summary": "2-3 sentence overview of dialogue in {lang_name}",\n'
                f'  "session_status": "Resolved",\n'
                f'  "recommended_next_steps": ["step 1 in {lang_name}", "step 2 in {lang_name}"],\n'
                f'  "category": "Technical Support",\n'
                f'  "subject": "3 to 6 word problem title in {lang_name}"\n'
                f'}}'
            )
            from backend.routes.chat_routes import GEMINI_CANDIDATE_MODELS
            for model_cand in GEMINI_CANDIDATE_MODELS:
                try:
                    response = client.models.generate_content(
                        model=model_cand,
                        contents=summary_prompt,
                    )
                    raw_text = (response.text or "").strip()
                    # Clean possible markdown fence
                    if "```" in raw_text:
                        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
                        if match:
                            raw_text = match.group(1).strip()
                    ai_generated = json.loads(raw_text)
                    if ai_generated and isinstance(ai_generated, dict):
                        break
                except Exception as cand_err:
                    logger.debug(f"Candidate model {model_cand} for summary failed: {cand_err}")
    except Exception as e:
        logger.warning(f"Gemini support summary generation error or offline: {e}")

    # Grounded dynamic fallback synthesizing from the actual conversation
    if not ai_generated or not isinstance(ai_generated, dict):
        first_user_inquiry = user_texts[0] if user_texts else "Customer support inquiry"
        last_agent_advice = agent_texts[-1] if agent_texts else "Customer support guidance provided."

        if active_lang == "te":
            ai_generated = {
                "issue_summary": f"కస్టమర్ నివేదించిన సమస్య: {first_user_inquiry}",
                "ai_understanding": f"కస్టమర్ అందించిన వివరణ: '{first_user_inquiry}'. సంభాషణలో సాంకేతిక అంశాలు మరియు లక్షణాలు సమగ్రంగా విశ్లేషించబడ్డాయి.",
                "resolution_provided": last_agent_advice,
                "conversation_summary": f"కస్టమర్ మరియు AI సపోర్ట్ ఏజెంట్ మధ్య {len(turns)} సంభాషణ మలుపులు జరిగాయి. '{first_user_inquiry[:50]}' సమస్య పరిష్కారానికి తగిన సూచనలు ఇవ్వబడ్డాయి.",
                "session_status": "Resolved",
                "recommended_next_steps": [
                    f"అందించిన సూచనల ప్రకారం '{first_user_inquiry[:35]}' సరిచూడండి.",
                    "సమస్య కొనసాగితే టిక్కెట్ సంఖ్యతో సంప్రదించండి."
                ],
                "category": "Technical Support",
                "subject": first_user_inquiry[:40]
            }
        elif active_lang == "hi":
            ai_generated = {
                "issue_summary": f"ग्राहक द्वारा दर्ज की गई समस्या: {first_user_inquiry}",
                "ai_understanding": f"ग्राहक ने '{first_user_inquiry}' के बारे में सहायता मांगी। समस्या निवारण एवं मुख्य बिंदुओं का विश्लेषण किया गया।",
                "resolution_provided": last_agent_advice,
                "conversation_summary": f"सपोर्ट सत्र के दौरान {len(turns)} संवाद हुए। '{first_user_inquiry[:50]}' के निवारण के लिए आवश्यक कदम सुझाए गए।",
                "session_status": "Resolved",
                "recommended_next_steps": [
                    f"सुझाए गए निर्देशों का पालन करके '{first_user_inquiry[:35]}' की पुष्टि करें।",
                    "यदि समस्या बनी रहती है तो इस टिकट संख्या का संदर्भ लें।"
                ],
                "category": "Technical Support",
                "subject": first_user_inquiry[:40]
            }
        else:
            ai_generated = {
                "issue_summary": first_user_inquiry,
                "ai_understanding": f"Customer reported: '{first_user_inquiry}'. Active troubleshooting conducted across {len(turns)} conversational turns.",
                "resolution_provided": last_agent_advice,
                "conversation_summary": f"Customer engaged in a {len(turns)}-turn support session regarding '{first_user_inquiry[:60]}'. AI support agent provided step-by-step diagnostic guidance.",
                "session_status": "Resolved",
                "recommended_next_steps": [
                    f"Follow the provided troubleshooting steps for '{first_user_inquiry[:35]}'.",
                    "Reference ticket ID for any additional follow-up assistance."
                ],
                "category": "Technical Support",
                "subject": first_user_inquiry[:40]
            }

    issue = ai_generated.get("issue_summary") or (user_texts[0] if user_texts else "Support Inquiry")
    ai_understanding = ai_generated.get("ai_understanding") or ""
    resolution = ai_generated.get("resolution_provided") or (agent_texts[-1] if agent_texts else "")
    conv_summary = ai_generated.get("conversation_summary") or ""
    session_status = ai_generated.get("session_status", "Resolved")
    next_steps = ai_generated.get("recommended_next_steps", [])
    category = ai_generated.get("category", "Technical Support")
    dynamic_subject = ai_generated.get("subject") or (user_texts[0][:40] if user_texts else "Support Inquiry")

    # Ensure ticket is created or updated
    ticket_created = False
    if not ticket:
        ticket = ticket_repository.create_ticket(
            subject=dynamic_subject,
            description=issue,
            category=category,
            priority="Medium",
            language=active_lang,
            user_id=req.user_id or "default_user",
            initial_message=user_texts[0] if user_texts else None,
            conversation_id=req.conversation_id
        )
        ticket_created = True

    # Append turns to ticket
    if ticket and turns:
        ticket_id = ticket["id"]
        for turn in turns[-6:]:
            msg = turn.get("text", "")
            spk = turn.get("speaker", "user")
            sender = "agent" if spk in ["ai", "agent", "assistant"] else "customer"
            if msg:
                try:
                    ticket_repository.add_ticket_message(ticket_id, sender, msg)
                except Exception:
                    pass

    duration_sec = req.duration_seconds or max(1, len(turns) * 12)

    summary_payload = {
        "session_status": session_status,
        "outcome": session_status,
        "issue": issue,
        "issue_summary": issue,
        "summary": conv_summary,
        "conversation_summary": conv_summary,
        "ai_understanding": ai_understanding,
        "actions": resolution,
        "troubleshooting_actions": resolution,
        "resolution_provided": resolution,
        "next_steps": next_steps,
        "recommended_next_steps": next_steps,
        "ticket_created": ticket_created or bool(ticket),
        "ticket_id": ticket.get("ticket_number", ticket.get("id")) if ticket else None,
        "raw_ticket_id": ticket.get("id") if ticket else None,
        "ticket_status": "Resolved",
        "priority": ticket.get("priority", "Medium") if ticket else "Medium",
        "category": category,
        "subject": dynamic_subject,
        "full_transcript": turns,
        "duration_seconds": duration_sec,
    }

    # Persist summary to ticket repository
    if ticket:
        try:
            ticket_repository.save_ticket_summary(ticket["id"], summary_payload, user_id=req.user_id)
        except Exception as e:
            logger.warning(f"Failed to persist ticket summary: {e}")

    # Persist summary to conversation repository
    if req.conversation_id:
        try:
            conversation_repository.save_summary(
                conv_id=req.conversation_id,
                summary_data=summary_payload,
                ticket_id=ticket.get("id") if ticket else None
            )
            # Update title from default to dynamic subject
            conv_current = conversation_repository.get_conversation(req.conversation_id)
            if conv_current and conv_current.get("title") in ["New Conversation", "Conversation", "New Support Inquiry", None]:
                conversation_repository.update_title(req.conversation_id, dynamic_subject)
        except Exception as e:
            logger.warning(f"Failed to persist conversation summary: {e}")
    return summary_payload

