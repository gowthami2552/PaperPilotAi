import os
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# App configurations
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
app.config['GENERATED_FOLDER'] = os.path.join(os.getcwd(), 'generated')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max upload

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['GENERATED_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)

# --- Database Models ---

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    photo_url = db.Column(db.String(255), default='https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='Uploaded')
    
    # Relationship to manuscript profiles
    profile = db.relationship('ManuscriptProfile', backref='project', uselist=False)

class ManuscriptProfile(db.Model):
    __tablename__ = 'manuscript_profiles'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    document_data = db.Column(db.JSON, default=dict)
    structure_data = db.Column(db.JSON, default=dict)
    citation_data = db.Column(db.JSON, default=dict)
    journal_data = db.Column(db.JSON, default=dict)
    quality_data = db.Column(db.JSON, default=dict)
    improvement_data = db.Column(db.JSON, default=list)
    final_score = db.Column(db.Integer, default=0)

class Journal(db.Model):
    __tablename__ = 'journals'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    publisher = db.Column(db.String(100))
    scope = db.Column(db.String(500))
    citation_style = db.Column(db.String(50))
    layout = db.Column(db.String(50))
    font = db.Column(db.String(50))
    format_rules = db.Column(db.JSON, default=dict)

# --- Database Initialization ---
with app.app_context():
    db.create_all()
    
    # Seed journals if empty
    if Journal.query.count() == 0:
        journals = [
            Journal(name="IEEE Access", publisher="IEEE", scope="Computer Science, Engineering", citation_style="Numbered", layout="Two-column", font="Times New Roman", format_rules={"margins": "1 inch", "spacing": "Single"}),
            Journal(name="Nature Communications", publisher="Springer Nature", scope="Multidisciplinary Sciences", citation_style="Author-Year", layout="Single-column", font="Arial", format_rules={"margins": "1 inch", "spacing": "Double"}),
            Journal(name="Artificial Intelligence", publisher="Elsevier", scope="AI, Machine Learning", citation_style="Author-Year", layout="Single-column", font="Times New Roman", format_rules={"margins": "1.25 inch", "spacing": "Double"}),
            Journal(name="ACM Computing Surveys", publisher="ACM", scope="Computer Science", citation_style="ACM Style", layout="Single-column", font="Linux Libertine", format_rules={"margins": "1 inch", "spacing": "Single"})
        ]
        db.session.bulk_save_objects(journals)
        db.session.commit()

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

# Import services after initializing db to avoid circular imports if needed
from services import document_analyzer, citation_analyzer, journal_service, ai_analyzer, formatter, document_generator, report_generator

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already exists"}), 400
    
    # In a real app, hash the password!
    user = User(
        name=data.get('name'),
        email=data.get('email'),
        password=data.get('password'),
        photo_url=f"https://ui-avatars.com/api/?name={data.get('name').replace(' ', '+')}&background=4f46e5&color=fff"
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "photo_url": user.photo_url
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email'), password=data.get('password')).first()
    if user:
        return jsonify({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "photo_url": user.photo_url
        })
    return jsonify({"error": "Invalid email or password"}), 401

@app.route('/api/profile/<int:user_id>', methods=['PUT'])
def update_profile(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    if 'name' in data:
        user.name = data['name']
        # Refresh avatar if photo isn't custom
        if 'ui-avatars.com' in user.photo_url:
             user.photo_url = f"https://ui-avatars.com/api/?name={user.name.replace(' ', '+')}&background=4f46e5&color=fff"
    if 'photo_url' in data and data['photo_url']:
        user.photo_url = data['photo_url']
    
    db.session.commit()
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "photo_url": user.photo_url,
        "message": "Profile updated successfully"
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and file.filename.endswith('.docx'):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Create DB records
        user_id = request.form.get('user_id')
        project = Project(name=filename.rsplit('.', 1)[0], filename=filename, user_id=user_id)
        db.session.add(project)
        db.session.flush()
        
        profile = ManuscriptProfile(project_id=project.id)
        db.session.add(profile)
        db.session.commit()
        
        return jsonify({
            "project_id": project.id,
            "filename": filename,
            "status": "success",
            "message": "File uploaded successfully"
        })
    return jsonify({"error": "Only .docx files are allowed"}), 400

@app.route('/api/analyze-document/<int:project_id>', methods=['POST'])
def analyze_document(project_id):
    project = Project.query.get_or_404(project_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], project.filename)
    
    result = document_analyzer.analyze(file_path)
    
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    profile.document_data = result
    profile.structure_data = document_analyzer.extract_structure(file_path)
    project.status = 'Document Analyzed'
    db.session.commit()
    
    return jsonify(result)

@app.route('/api/analyze-citations/<int:project_id>', methods=['POST'])
def analyze_citations(project_id):
    project = Project.query.get_or_404(project_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], project.filename)
    
    result = citation_analyzer.analyze(file_path)
    
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    profile.citation_data = result
    project.status = 'Citations Analyzed'
    db.session.commit()
    
    return jsonify(result)

@app.route('/api/projects', methods=['GET'])
def get_projects():
    user_id = request.args.get('user_id')
    query = Project.query
    if user_id:
        query = query.filter_by(user_id=user_id)
    projects = query.order_by(Project.created_at.desc()).all()
    
    result = []
    for p in projects:
        profile = ManuscriptProfile.query.filter_by(project_id=p.id).first()
        score = profile.final_score if profile and profile.final_score else 0
        result.append({
            "id": p.id,
            "name": p.name,
            "status": p.status,
            "score": score,
            "date": p.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return jsonify(result)

@app.route('/api/project/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    
    if profile:
        db.session.delete(profile)
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": "Project deleted successfully"})

@app.route('/api/journals', methods=['GET'])
def get_journals():
    journals = Journal.query.all()
    return jsonify([{
        "id": j.id,
        "name": j.name,
        "publisher": j.publisher,
        "scope": j.scope,
        "citation_style": j.citation_style,
        "layout": j.layout,
        "font": j.font
    } for j in journals])

@app.route('/api/select-journal/<int:project_id>', methods=['POST'])
def select_journal(project_id):
    data = request.json
    journal_id = data.get('journal_id')
    
    project = Project.query.get_or_404(project_id)
    journal = Journal.query.get_or_404(journal_id)
    
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    profile.journal_data = {
        "id": journal.id,
        "name": journal.name,
        "format_rules": journal.format_rules
    }
    project.status = 'Journal Selected'
    db.session.commit()
    
    return jsonify({"status": "success", "journal_selected": journal.name})

@app.route('/api/ai-review/<int:project_id>', methods=['POST'])
def ai_review(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], project.filename)
    
    result = ai_analyzer.evaluate_manuscript(profile, file_path)
    
    profile.quality_data = result
    project.status = 'AI Review Completed'
    db.session.commit()
    
    return jsonify(result)

@app.route('/api/improvements/<int:project_id>', methods=['POST'])
def get_improvements(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], project.filename)
    
    result = ai_analyzer.generate_improvements(profile, file_path)
    
    profile.improvement_data = result
    db.session.commit()
    
    return jsonify(result)

@app.route('/api/format/<int:project_id>', methods=['POST'])
def format_manuscript(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], project.filename)
    formatted_path = os.path.join(app.config['GENERATED_FOLDER'], f"formatted_{project.filename}")
    
    result = formatter.apply_formatting(file_path, formatted_path, profile.journal_data)
    
    project.status = 'Formatted'
    db.session.commit()
    
    return jsonify({"status": "success", "message": "Document formatted successfully"})

@app.route('/api/generate-document/<int:project_id>', methods=['POST'])
def generate_doc(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    
    formatted_path = os.path.join(app.config['GENERATED_FOLDER'], f"formatted_{project.filename}")
    ready_path = os.path.join(app.config['GENERATED_FOLDER'], f"publication_ready_{project.filename}")
    
    result = document_generator.finalize_document(formatted_path, ready_path, profile)
    
    # Calculate final score
    score = ai_analyzer.calculate_final_score(profile)
    profile.final_score = score
    project.status = 'Ready for Submission' if score > 80 else 'Revision Required'
    db.session.commit()
    
    return jsonify({"status": "success", "final_score": score, "readiness": project.status})

@app.route('/api/report/<int:project_id>', methods=['GET'])
def get_report(project_id):
    project = Project.query.get_or_404(project_id)
    profile = ManuscriptProfile.query.filter_by(project_id=project.id).first()
    return jsonify({
        "project_name": project.name,
        "quality_data": profile.quality_data,
        "improvement_data": profile.improvement_data,
        "final_score": profile.final_score
    })

@app.route('/api/export/docx/<int:project_id>', methods=['GET'])
def export_docx(project_id):
    project = Project.query.get_or_404(project_id)
    ready_path = os.path.join(app.config['GENERATED_FOLDER'], f"publication_ready_{project.filename}")
    if os.path.exists(ready_path):
        return send_file(ready_path, as_attachment=True)
    return jsonify({"error": "File not generated yet"}), 404

@app.route('/api/export/pdf/<int:project_id>', methods=['GET'])
def export_pdf(project_id):
    project = Project.query.get_or_404(project_id)
    pdf_path = report_generator.generate_pdf(project.id, app.config['GENERATED_FOLDER'], ManuscriptProfile.query.filter_by(project_id=project.id).first())
    if os.path.exists(pdf_path):
        return send_file(pdf_path, as_attachment=True)
    return jsonify({"error": "PDF not generated yet"}), 404

import zipfile

@app.route('/api/export-package/<int:project_id>', methods=['GET'])
def export_package(project_id):
    project = Project.query.get_or_404(project_id)
    ready_path = os.path.join(app.config['GENERATED_FOLDER'], f"publication_ready_{project.filename}")
    pdf_path = report_generator.generate_pdf(project.id, app.config['GENERATED_FOLDER'], ManuscriptProfile.query.filter_by(project_id=project.id).first())
    
    zip_filename = f"Submission_Package_{project.name}.zip"
    zip_path = os.path.join(app.config['GENERATED_FOLDER'], zip_filename)
    
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        if os.path.exists(ready_path):
            zipf.write(ready_path, f"{project.name}_formatted.docx")
        if os.path.exists(pdf_path):
            zipf.write(pdf_path, f"{project.name}_readiness_report.pdf")
            
        # Add a README
        readme_path = os.path.join(app.config['GENERATED_FOLDER'], "README.txt")
        with open(readme_path, "w") as f:
            f.write(f"Submission Package for {project.name}\nGenerated by PaperPilot AI")
        zipf.write(readme_path, "README.txt")
        
    if os.path.exists(zip_path):
        return send_file(zip_path, as_attachment=True)
    return jsonify({"error": "Failed to create zip package"}), 500

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "API route not found"}), 404
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5050)
