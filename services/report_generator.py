import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def generate_pdf(project_id, output_folder, profile):
    pdf_path = os.path.join(output_folder, f"readiness_report_{project_id}.pdf")
    
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 80, "ResearchReady AI Report")
    
    c.setFont("Helvetica", 14)
    c.drawString(50, height - 120, f"Final Readiness Score: {profile.final_score}/100")
    
    y = height - 160
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "AI Analysis Summary")
    y -= 30
    
    c.setFont("Helvetica", 12)
    quality = profile.quality_data
    if quality:
        c.drawString(50, y, f"Novelty: {quality.get('novelty', 'N/A')}")
        y -= 20
        c.drawString(50, y, f"Originality: {quality.get('originality', 'N/A')}")
        y -= 20
        c.drawString(50, y, f"Methodology: {quality.get('methodology', 'N/A')}")
        y -= 20
        c.drawString(50, y, f"Technical Contribution: {quality.get('technical_contribution', 'N/A')}")
        y -= 20
        c.drawString(50, y, f"Status: {quality.get('status', 'N/A')}")
    else:
        c.drawString(50, y, "Quality data not available.")
        
    y -= 40
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Top Improvements")
    y -= 30
    
    c.setFont("Helvetica", 10)
    for imp in profile.improvement_data[:3]:
        c.drawString(50, y, f"- {imp.get('title')}: {imp.get('recommendation')}")
        y -= 20
        
    c.save()
    return pdf_path
