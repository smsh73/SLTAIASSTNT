FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    pandas \
    numpy \
    matplotlib \
    seaborn \
    scipy \
    scikit-learn \
    jupyter \
    requests \
    openpyxl \
    xlrd \
    python-docx \
    PyPDF2 \
    pillow

# Create non-root user for security
RUN useradd -m -u 1000 executor && chown -R executor:executor /app
USER executor

CMD ["python", "-c", "import sys; sys.stdin.read()"]

