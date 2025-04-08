document.addEventListener('DOMContentLoaded', () => {
  // Elementos comuns
  const showError = (message, elementId = 'errorMessage') => {
    const errorElement = document.getElementById(elementId);
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
    
    setTimeout(() => {
      errorElement.classList.add('d-none');
    }, 5000);
  };

  // Login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      
      if (!email || !password) {
        return showError('Preencha todos os campos');
      }

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(text || 'Resposta inválida do servidor');
        }

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao fazer login');
        }

        window.location.href = '/';
      } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
      }
    });
  }

  // Registro
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const confirmPassword = document.getElementById('confirmPassword').value.trim();
      
      if (!name || !email || !password || !confirmPassword) {
        return showError('Preencha todos os campos');
      }

      if (password.length < 6) {
        return showError('A senha deve ter pelo menos 6 caracteres');
      }

      if (password !== confirmPassword) {
        return showError('As senhas não coincidem');
      }

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao registrar');
        }

        alert('Registro realizado com sucesso! Faça login.');
        window.location.href = '/login';
      } catch (error) {
        console.error('Registration error:', error);
        showError(error.message);
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/logout', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
});
