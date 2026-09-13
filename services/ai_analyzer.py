import os
import json
import google.generativeai as genai
import docx

def get_document_text(file_path):
    try:
        doc = docx.Document(file_path)
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return text[:15000] # Limit to avoid token limits for prototype
    except:
        return ""

def get_gemini_response(prompt, json_mode=True):
    api_key = os.environ.get("AI_API_KEY")
    if not api_key or api_key == "YOUR_API_KEY":
        return None
    
    try:
        genai.configure(api_key=api_key)
        # Use gemini-1.5-flash for faster responses in hackathon
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        response = model.generate_content(prompt)
        text = response.text
        
        if json_mode:
            # Clean up potential markdown formatting
            text = text.replace('```json', '').replace('```', '').strip()
            return json.loads(text)
        return text
    except Exception as e:
        print(f"AI API Error: {e}")
        return None

def evaluate_manuscript(profile, file_path):
    doc_text = get_document_text(file_path)
    
    prompt = f"""
    You are an expert academic reviewer. Analyze the following research manuscript excerpt.
    Evaluate the following metrics on a scale of 0 to 100:
    - novelty
    - originality
    - innovation
    - technical_contribution
    - methodology
    - completeness
    - writing_quality
    - journal_fit (assume general academic fit)
    - overall_score
    
    Also provide a short status (e.g., "Ready", "Minor Revision", "Major Revision").
    
    Return ONLY a raw JSON object with these exact keys:
    {{"novelty": 0, "originality": 0, "innovation": 0, "technical_contribution": 0, "methodology": 0, "completeness": 0, "writing_quality": 0, "journal_fit": 0, "overall_score": 0, "status": ""}}
    
    Manuscript Text Excerpt:
    {doc_text[:3000]}
    """
    
    result = get_gemini_response(prompt, json_mode=True)
    
    if result:
        return result
        
    # Smart mock fallback based on structure data
    structure_score = profile.document_data.get('structure_score', 75)
    citation_score = profile.citation_data.get('citation_score', 75)
    base = (structure_score + citation_score) / 2
    
    return {
        "novelty": min(98, int(base + 5)),
        "originality": min(95, int(base + 3)),
        "innovation": min(92, int(base + 4)),
        "technical_contribution": min(95, int(base + 6)),
        "methodology": min(90, int(base - 2)),
        "completeness": min(100, int(structure_score + 10)),
        "writing_quality": min(100, int(base + 8)),
        "journal_fit": min(98, int(base + 7)),
        "overall_score": min(100, int(base + 5)),
        "status": "Ready for Submission" if base > 80 else "Minor Revision Recommended"
    }

def generate_improvements(profile, file_path):
    doc_text = get_document_text(file_path)
    
    prompt = f"""
    You are an expert academic reviewer. Analyze this research text and provide 3 concrete, actionable improvement recommendations for the author before they submit to a journal.
    
    Return ONLY a raw JSON array of objects with the following keys:
    "title" (short), "priority" (HIGH, MEDIUM, LOW), "problem" (1 sentence), "recommendation" (1 sentence).
    
    Text:
    {doc_text[:2000]}
    """
    
    result = get_gemini_response(prompt, json_mode=True)
    
    if result and isinstance(result, list):
        for item in result:
            item['applied'] = False
        return result
        
    # Smart fallback based on issues
    issues = profile.citation_data.get('issues', [])
    improvements = []
    
    if profile.document_data.get('sections', 0) < 4:
        improvements.append({
            "title": "Expand Document Structure",
            "priority": "HIGH",
            "problem": "The manuscript has very few sections.",
            "recommendation": "Ensure you have standard sections: Abstract, Introduction, Methodology, Results, Discussion, Conclusion.",
            "applied": False
        })
        
    for issue in issues:
        if issue['type'] in ['warning', 'danger']:
            improvements.append({
                "title": "Address Citation Issues",
                "priority": "HIGH",
                "problem": issue['message'],
                "recommendation": "Review references and in-text citations to ensure every citation matches a reference.",
                "applied": False
            })
            break
            
    if not improvements:
        improvements = [
            {
                "title": "Strengthen Methodology Detail",
                "priority": "MEDIUM",
                "problem": "Some experimental parameters may be implicit.",
                "recommendation": "Explicitly state all hyperparameters and setup details for reproducibility.",
                "applied": False
            },
            {
                "title": "Enhance Novelty Claims",
                "priority": "LOW",
                "problem": "The distinction from prior work could be sharper.",
                "recommendation": "Add a summary table comparing your results directly to state-of-the-art baselines.",
                "applied": False
            }
        ]
        
    return improvements

def calculate_final_score(profile):
    q = profile.quality_data
    if not q:
        return 86
    
    return q.get('overall_score', 86)
