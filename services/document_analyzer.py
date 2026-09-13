import docx
import re

def analyze(file_path):
    try:
        doc = docx.Document(file_path)
    except Exception as e:
        return {"error": "Invalid DOCX file"}

    paragraphs = len(doc.paragraphs)
    tables = len(doc.tables)
    
    sections = 0
    figures = 0
    equations = 0
    
    # Analyze sections based on common headings
    common_sections = ['abstract', 'introduction', 'literature', 'methodology', 'method', 'materials', 'results', 'discussion', 'conclusion', 'references', 'bibliography']
    
    for p in doc.paragraphs:
        # Detect sections
        if p.style.name.startswith('Heading') or len(p.text) < 50:
            text_lower = p.text.lower().strip()
            if any(sec in text_lower for sec in common_sections):
                sections += 1
                
        # Basic equation heuristic (often contains equal signs and math symbols in a short line)
        if '=' in p.text and len(p.text) < 100 and any(c in p.text for c in ['+', '-', '*', '/']):
            equations += 1

    # Count figures (inline shapes)
    try:
        for rel in doc.part.rels.values():
            if "image" in rel.reltype:
                figures += 1
    except:
        pass

    # Ensure we don't have 0 for basic metrics if the document has content
    if sections == 0 and paragraphs > 10:
        sections = paragraphs // 15
        
    return {
        "pages": max(1, paragraphs // 30),
        "sections": sections,
        "tables": tables,
        "figures": figures,
        "equations": equations,
        "citations": 0, # Populated by citation_analyzer
        "references": 0, # Populated by citation_analyzer
        "structure_score": min(100, 50 + (sections * 5) + (tables * 2) + (figures * 2))
    }

def extract_structure(file_path):
    try:
        doc = docx.Document(file_path)
    except:
        return []

    structure = []
    current_level = 1
    
    for p in doc.paragraphs:
        if p.style.name.startswith('Heading'):
            level = 1
            # Try to extract level from style name e.g. "Heading 2"
            match = re.search(r'\d+', p.style.name)
            if match:
                level = int(match.group())
            
            # Avoid empty headings
            if p.text.strip():
                structure.append({"text": p.text.strip(), "level": level})
                
    # If no explicit headings, try to guess from short bold paragraphs
    if not structure:
        for p in doc.paragraphs:
            if len(p.text) > 2 and len(p.text) < 60 and (p.runs and p.runs[0].bold):
                structure.append({"text": p.text.strip(), "level": 1})
                
    if not structure:
        structure = [{"text": "Document Content", "level": 1}]
        
    return structure
