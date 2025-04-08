class PlanilhaUploader {
  constructor() {
    this.initElements();
    this.initEvents();
    this.loadUserData();
  }

  initElements() {
    this.uploadForm = document.getElementById('uploadForm');
    this.resultsDiv = document.getElementById('results');
    this.summaryDiv = document.getElementById('summary');
    this.resultsBody = document.getElementById('resultsBody');
    this.loadingModal = new bootstrap.Modal('#loadingModal');
    this.filterValid = document.getElementById('filterValid');
    this.filterInvalid = document.getElementById('filterInvalid');
  }

  initEvents() {
    if (this.uploadForm) {
      this.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
    }

    if (this.filterValid && this.filterInvalid) {
      this.filterValid.addEventListener('change', () => this.filterResults());
      this.filterInvalid.addEventListener('change', () => this.filterResults());
    }
  }

  async loadUserData() {
    try {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.user && document.getElementById('userName')) {
          document.getElementById('userName').textContent = data.user.name;
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  async handleUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('planilha');
    
    if (!fileInput.files.length) {
      this.showAlert('Por favor, selecione um arquivo', 'warning');
      return;
    }

    this.loadingModal.show();

    try {
      const formData = new FormData();
      formData.append('planilha', fileInput.files[0]);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Resposta inválida do servidor');
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      this.displayResults(data);
      this.showAlert('Planilha processada com sucesso!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      this.showAlert(error.message, 'danger');
    } finally {
      this.loadingModal.hide();
      this.uploadForm.reset();
    }
  }

  displayResults(data) {
    if (!data || !data.dados) return;

    // Atualizar resumo
    this.summaryDiv.innerHTML = `
      <strong>Arquivo:</strong> ${data.fileName}<br>
      <strong>Total registros:</strong> ${data.totalRegistros}<br>
      <strong>Válidos:</strong> ${data.registrosValidos} (${Math.round((data.registrosValidos / data.totalRegistros) * 100)}%)<br>
      <strong>Inválidos:</strong> ${data.registrosInvalidos}
    `;

    // Preencher tabela
    this.resultsBody.innerHTML = '';
    data.dados.forEach(registro => {
      const tr = document.createElement('tr');
      tr.className = registro.valido ? 'table-success' : 'table-danger';
      tr.dataset.valid = registro.valido;
      
      tr.innerHTML = `
        <td>${registro.linha}</td>
        <td>${registro.dados.CNPJ || '-'}</td>
        <td>${registro.dados['Nome do entregador'] || '-'}</td>
        <td>${registro.dados['Status Viagem'] || '-'}</td>
        <td>${registro.erros.length ? registro.erros.join(', ') : '✔'}</td>
      `;
      
      this.resultsBody.appendChild(tr);
    });

    this.resultsDiv.classList.remove('d-none');
    this.filterResults();
  }

  filterResults() {
    const showValid = this.filterValid.checked;
    const showInvalid = this.filterInvalid.checked;
    
    document.querySelectorAll('#resultsBody tr').forEach(tr => {
      const isValid = tr.dataset.valid === 'true';
      
      if ((isValid && showValid) || (!isValid && showInvalid)) {
        tr.style.display = '';
      } else {
        tr.style.display = 'none';
      }
    });
  }

  showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container-fluid.mt-4');
    if (container) {
      container.prepend(alertDiv);
      
      // Remove automaticamente após 5 segundos
      setTimeout(() => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
        bsAlert.close();
      }, 5000);
    }
  }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new PlanilhaUploader();
});
