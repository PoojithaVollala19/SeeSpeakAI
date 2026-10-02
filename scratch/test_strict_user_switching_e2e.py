import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    print("==================================================")
    print("STRICT USER ISOLATION & SWITCHING VERIFICATION TEST")
    print("==================================================")
    
    unique_suffix = uuid.uuid4().hex[:6]
    user_a_email = f"user_a_{unique_suffix}@example.com"
    user_b_email = f"user_b_{unique_suffix}@example.com"
    password = "SecurePassword123!"

    # 1. Register User A
    print(f"\n--- STEP 1: Register and login as User A ({user_a_email}) ---")
    res_a = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "User Alpha",
        "email": user_a_email,
        "password": password
    })
    assert res_a.status_code == 200, f"Register A failed: {res_a.text}"
    token_a = res_a.json()["token"]
    user_a_id = res_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"Registered User A with ID: {user_a_id}")

    # Generate Activity for User A:
    # A1. Conversation
    conv_res = requests.post(f"{BASE_URL}/api/conversations", json={
        "title": "User A Financial Doc Review",
        "feature": "document-analysis"
    }, headers=headers_a)
    assert conv_res.status_code == 200, f"Create conv A failed: {conv_res.text}"
    conv_a_id = conv_res.json()["id"]

    # A2. Support Ticket
    ticket_res = requests.post(f"{BASE_URL}/api/tickets", json={
        "conversation_id": conv_a_id,
        "category": "technical",
        "priority": "high",
        "status": "in_progress",
        "subject": "User A Screen Share Glitch",
        "summary": "Alpha camera not rendering"
    }, headers=headers_a)
    assert ticket_res.status_code == 200, f"Create ticket A failed: {ticket_res.text}"

    # A3. Interview Session
    interview_res = requests.post(f"{BASE_URL}/api/interviews/sessions", json={
        "topic": "Python Systems Architect",
        "difficulty": "hard",
        "language": "en"
    }, headers=headers_a)
    assert interview_res.status_code == 200, f"Create interview A failed: {interview_res.text}"
    interview_a_id = interview_res.json()["id"]

    # Complete interview for User A
    eval_res = requests.post(f"{BASE_URL}/api/interviews/sessions/{interview_a_id}/complete", json={
        "duration_seconds": 320,
        "transcript": [
            {"speaker": "ai", "text": "Can you explain how you design distributed caching in Python?"},
            {"speaker": "user", "text": "We utilize Redis clusters with consistent hashing, LRU eviction policies, and cache-aside patterns to handle high throughput and prevent stampedes."}
        ]
    }, headers=headers_a)
    assert eval_res.status_code == 200, f"Complete interview A failed: {eval_res.text}"
    print("Complete interview response evaluation:", eval_res.json().get("evaluation"))

    # Verify User A sees everything
    a_convs = requests.get(f"{BASE_URL}/api/conversations", headers=headers_a).json()
    a_tickets = requests.get(f"{BASE_URL}/api/tickets", headers=headers_a).json()
    a_interviews = requests.get(f"{BASE_URL}/api/interviews/sessions", headers=headers_a).json()
    a_analytics = requests.get(f"{BASE_URL}/api/analytics", headers=headers_a).json()

    print(f"User A sees:")
    print(f"  - Conversations: {len(a_convs)} (Expected 1)")
    print(f"  - Tickets: {len(a_tickets)} (Expected 1)")
    print(f"  - Interviews: {len(a_interviews)} (Expected 1)")
    print(f"  - Analytics Total Conversations: {a_analytics['overview']['total_conversations']}")
    print(f"  - Analytics Avg Interview Score: {a_analytics['interviews']['average_score']}")
    assert len(a_convs) == 1
    assert len(a_tickets) == 1
    assert a_analytics["overview"]["total_conversations"] == 1
    assert a_analytics["overview"]["total_interviews"] == 1
    assert a_analytics["interviews"]["average_score"] > 0

    # 2. STEP 2: Logout User A
    print("\n--- STEP 2: Logout User A ---")
    logout_a = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers_a)
    assert logout_a.status_code == 200
    print("User A logged out successfully.")

    # 3. STEP 3: Register and Login as User B
    print(f"\n--- STEP 3: Register and login as User B ({user_b_email}) ---")
    res_b = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "User Beta",
        "email": user_b_email,
        "password": password
    })
    assert res_b.status_code == 200
    token_b = res_b.json()["token"]
    user_b_id = res_b.json()["user"]["id"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f"Registered User B with ID: {user_b_id}")

    # VERIFY USER B SEES ZERO OF USER A'S DATA!
    b_convs = requests.get(f"{BASE_URL}/api/conversations", headers=headers_b).json()
    b_tickets = requests.get(f"{BASE_URL}/api/tickets", headers=headers_b).json()
    b_interviews = requests.get(f"{BASE_URL}/api/interviews/sessions", headers=headers_b).json()
    b_analytics = requests.get(f"{BASE_URL}/api/analytics", headers=headers_b).json()

    print(f"User B initial checks (MUST BE ZERO):")
    print(f"  - Conversations: {len(b_convs)} (Expected 0)")
    print(f"  - Tickets: {len(b_tickets)} (Expected 0)")
    print(f"  - Interviews: {len(b_interviews)} (Expected 0)")
    print(f"  - Total Conversations: {b_analytics['overview']['total_conversations']} (Expected 0)")
    print(f"  - Tickets Count: {b_analytics['overview']['total_tickets']} (Expected 0)")
    print(f"  - Interview Count: {b_analytics['overview']['total_interviews']} (Expected 0)")

    assert len(b_convs) == 0, f"LEAK! User B saw User A's conversations: {b_convs}"
    assert len(b_tickets) == 0, f"LEAK! User B saw User A's tickets: {b_tickets}"
    assert len(b_interviews) == 0, f"LEAK! User B saw User A's interviews: {b_interviews}"
    assert b_analytics["overview"]["total_conversations"] == 0, "LEAK! Analytics leaked conversations"
    assert b_analytics["overview"]["total_tickets"] == 0, "LEAK! Analytics leaked tickets"
    assert b_analytics["overview"]["total_interviews"] == 0, "LEAK! Analytics leaked interviews"

    # Also test direct ID access by User B to User A's conversation
    unauth_conv_res = requests.get(f"{BASE_URL}/api/conversations/{conv_a_id}", headers=headers_b)
    print(f"User B direct GET of User A's conversation ID returned: {unauth_conv_res.status_code}")
    assert unauth_conv_res.status_code in [403, 404], f"User B was able to fetch User A's conversation directly!"

    # 4. STEP 4: Generate new activity as User B
    print("\n--- STEP 4: Generate new activity for User B ---")
    conv_b_res = requests.post(f"{BASE_URL}/api/conversations", json={
        "title": "User B Telugu Voice Study",
        "feature": "data-study"
    }, headers=headers_b)
    assert conv_b_res.status_code == 200

    b_convs_after = requests.get(f"{BASE_URL}/api/conversations", headers=headers_b).json()
    b_analytics_after = requests.get(f"{BASE_URL}/api/analytics", headers=headers_b).json()
    print(f"User B now sees:")
    print(f"  - Conversations: {len(b_convs_after)} (Expected 1)")
    print(f"  - Analytics Total Conversations: {b_analytics_after['overview']['total_conversations']} (Expected 1)")
    assert len(b_convs_after) == 1
    assert b_analytics_after["overview"]["total_conversations"] == 1
    assert b_convs_after[0]["title"] == "User B Telugu Voice Study"

    # 5. STEP 5: Logout User B, Login as User A again
    print("\n--- STEP 5: Login as User A again and verify isolation ---")
    res_a_again = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": user_a_email,
        "password": password
    })
    assert res_a_again.status_code == 200
    token_a_again = res_a_again.json()["token"]
    headers_a_again = {"Authorization": f"Bearer {token_a_again}"}

    a_convs_final = requests.get(f"{BASE_URL}/api/conversations", headers=headers_a_again).json()
    a_analytics_final = requests.get(f"{BASE_URL}/api/analytics", headers=headers_a_again).json()

    print(f"User A final checks:")
    print(f"  - Conversations: {len(a_convs_final)} (Expected 1)")
    print(f"  - Analytics Workspaces: {a_analytics_final['overview']['total_conversations']} (Expected 1)")
    assert len(a_convs_final) == 1
    assert a_analytics_final["overview"]["total_conversations"] == 1
    assert a_convs_final[0]["title"] == "User A Financial Doc Review"
    # Ensure User B's conversation is NOT visible to User A
    assert not any(c["title"] == "User B Telugu Voice Study" for c in a_convs_final)

    print("\n==================================================")
    print("SUCCESS: ALL STRICT USER ISOLATION CHECKS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_test()
