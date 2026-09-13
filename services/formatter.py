import docx
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT, WD_LINE_SPACING

def apply_formatting(input_path, output_path, journal_data):
    try:
        doc = docx.Document(input_path)
    except:
        return {"error": "Invalid DOCX file"}

    # Extract rules
    rules = journal_data.get('format_rules', {})
    font_name = journal_data.get('font', 'Times New Roman')
    layout = journal_data.get('layout', 'Single-column')
    margins = rules.get('margins', '1 inch')
    spacing_rule = rules.get('spacing', 'Double')

    # Convert margin to Inches
    margin_val = 1.0
    if '1.25' in margins:
        margin_val = 1.25
        
    # Apply to all sections
    for section in doc.sections:
        section.top_margin = Inches(margin_val)
        section.bottom_margin = Inches(margin_val)
        section.left_margin = Inches(margin_val)
        section.right_margin = Inches(margin_val)
        
        # Prototype two-column layout simulation (real python-docx requires complex oxml for columns)
        # We will add a note in the document if two-column is requested
        
    # Apply to paragraphs
    for p in doc.paragraphs:
        # Update fonts
        if p.style.name == 'Normal':
            p.alignment = WD_PARAGRAPH_ALIGNMENT.JUSTIFY
            p.paragraph_format.space_after = Pt(12)
            
            if spacing_rule == 'Double':
                p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
            else:
                p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
                
        for run in p.runs:
            run.font.name = font_name
            
        # Format headings based on journal
        if p.style.name.startswith('Heading'):
            for run in p.runs:
                run.font.name = font_name
                run.bold = True
                
            if journal_data.get('publisher') == 'IEEE':
                p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
            else:
                p.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT

    # Add a watermark/header indicating applied format
    try:
        header = doc.sections[0].header
        hp = header.paragraphs[0]
        hp.text = f"Formatted for {journal_data.get('name', 'Selected Journal')} by ResearchReady AI"
        hp.alignment = WD_PARAGRAPH_ALIGNMENT.RIGHT
        hp.runs[0].font.size = Pt(8)
        hp.runs[0].font.color.rgb = docx.shared.RGBColor(128, 128, 128)
    except:
        pass

    try:
        doc.save(output_path)
        return True
    except Exception as e:
        print(f"Error saving formatted doc: {e}")
        return False
