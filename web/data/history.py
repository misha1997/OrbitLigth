""""On this day in space history" lookup for the homepage."""

def get_history_today(lang: str) -> dict:
    from database import get_db_connection
    import datetime
    import random
    today = datetime.date.today()
    m = today.month
    d = today.day
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM space_history WHERE month=%s AND day=%s", (m, d))
    events = cur.fetchall()
    
    is_today = True
    if not events:
        cur.execute("SELECT * FROM space_history")
        events = cur.fetchall()
        is_today = False
        
    cur.close()
    conn.close()
    
    if not events:
        return None
        
    ev = random.choice(events)
    return {
        "m": ev["month"],
        "d": ev["day"],
        "year": ev["year"],
        "text": ev["text_uk"] if lang == "uk" else ev["text_en"],
        "isToday": is_today
    }
