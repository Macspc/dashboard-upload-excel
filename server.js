
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;





// Configuração do MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'login_dashboard',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Configuração da sessão
app.use(session({
  secret: 'suaChaveSecreta123',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Configurações do Express
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuração do Multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `planilha-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (['.xls', '.xlsx'].includes(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xls, .xlsx) são permitidos'));
    }
  }
});

// Middleware de autenticação
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Rotas de autenticação
app.get('/login', (req, res) => {
  res.render('login', { error: null, username: '' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?', 
      [username]
    );

    if (rows.length === 0) {
      return res.render('login', { 
        error: 'Usuário não encontrado', 
        username 
      });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.render('login', { 
        error: 'Senha incorreta', 
        username 
      });
    }

    req.session.user = { id: user.id, username: user.username };
    res.redirect('/dashboard');

  } catch (error) {
    console.error('Erro no login:', error);
    res.render('login', { 
      error: 'Erro durante o login', 
      username 
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Rotas protegidas
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// Configuração dos campos obrigatórios da planilha
const CAMPOS_OBRIGATORIOS = [
  { original: 'CNPJ', normalizado: 'cnpj', tipo: 'cnpj', obrigatorio: true },
  { original: 'Endereço Empresa', normalizado: 'enderecoEmpresa', tipo: 'texto', obrigatorio: true },
  { original: '(DDD) Telefone', normalizado: 'telefone', tipo: 'texto', obrigatorio: true },
  { original: 'Nome do entregador', normalizado: 'entregador', tipo: 'texto', obrigatorio: true },
  { original: 'CPF', normalizado: 'cpf', tipo: 'cpf', obrigatorio: true },
  { original: 'Endereço de Partida', normalizado: 'enderecoPartida', tipo: 'texto', obrigatorio: true },
  { original: 'ID Viagem', normalizado: 'idViagem', tipo: 'texto', obrigatorio: true },
  { original: 'Status Viagem', normalizado: 'statusViagem', tipo: 'texto', obrigatorio: true },
  { original: 'Endereço de Chegada', normalizado: 'enderecoChegada', tipo: 'texto', obrigatorio: false },
  { original: 'Data', normalizado: 'data', tipo: 'texto', obrigatorio: true }
];

// Adicione estas rotas após as rotas de login existentes

// Rota para exibir formulário de cadastro
app.get('/register', (req, res) => {
    res.render('register', { error: null, formData: {} });
  });
  
  // Rota para processar cadastro
  app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    try {
      // Verifica se usuário já existe
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?', 
        [username, email]
      );
  
      if (existing.length > 0) {
        return res.render('register', { 
          error: 'Usuário ou email já cadastrado',
          formData: req.body
        });
      }
  
      // Cria hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);
      
      
  
      
      
      
      // Insere novo usuário
      await pool.execute(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email]
      );
  
      req.session.success = 'Cadastro realizado com sucesso! Faça login.';
      res.redirect('/login');
  
    } catch (error) {
      console.error('Erro no cadastro:', error);
      res.render('register', { 
        error: 'Erro ao cadastrar. Tente novamente.',
        formData: req.body
      });
    }
  });
  
  // Rota para exibir formulário "Esqueceu a senha"
  app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { error: null, message: null, email: '' });
  });
  
  // Rota para processar "Esqueceu a senha"
  app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
      // Verifica se email existe
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE email = ?', 
        [email]
      );
  
      if (users.length === 0) {
        return res.render('forgot-password', { 
          error: 'Email não encontrado',
          message: null,
          email
        });
      }
  
      // Gera token e data de expiração
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hora
      
      await pool.execute(
        'UPDATE users SET reset_token = ?, token_expiry = ? WHERE email = ?',
        [token, expiry, email]
      );
  
      // Aqui você deveria enviar um email com o link (implementação real necessária)
      const resetLink = `http://${req.headers.host}/reset-password?token=${token}`;
      console.log('Link de redefinição (simulação):', resetLink);
  
      res.render('forgot-password', { 
        error: null,
        message: 'Instruções enviadas para seu email',
        email: ''
      });
  
    } catch (error) {
      console.error('Erro em esqueceu a senha:', error);
      res.render('forgot-password', { 
        error: 'Erro ao processar solicitação',
        message: null,
        email
      });
    }
  });
  
  // Rota para exibir formulário de redefinição
  app.get('/reset-password', async (req, res) => {
    const { token } = req.query;
    
    try {
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE reset_token = ? AND token_expiry > NOW()',
        [token]
      );
  
      if (users.length === 0) {
        return res.render('reset-password', {
          error: 'Link inválido ou expirado',
          token: null
        });
      }
  
      res.render('reset-password', {
        error: null,
        token
      });
  
    } catch (error) {
      res.render('reset-password', {
        error: 'Erro ao verificar token',
        token: null
      });
    }
  });
  
  // Rota para processar redefinição
  app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    
    try {
      // Verifica token válido
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE reset_token = ? AND token_expiry > NOW()',
        [token]
      );
  
      if (users.length === 0) {
        return res.render('reset-password', {
          error: 'Link inválido ou expirado',
          token: null
        });
      }
  
      // Atualiza senha
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET password = ?, reset_token = NULL, token_expiry = NULL WHERE reset_token = ?',
        [hashedPassword, token]
      );
  
      req.session.success = 'Senha redefinida com sucesso! Faça login.';
      res.redirect('/login');
  
    } catch (error) {
      res.render('reset-password', {
        error: 'Erro ao redefinir senha',
        token
      });
    }
  });



// Rota de upload e análise
app.post('/upload', requireLogin, upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).render('error', { 
        error: 'Nenhum arquivo enviado',
        user: req.session.user
      });
    }

    const { dadosProcessados, problemas } = await processarPlanilha(req.file.path);
    
    const resultado = {
      nomeArquivo: req.file.originalname,
      totalRegistros: dadosProcessados.length,
      registrosValidos: dadosProcessados.filter(d => d.valido).length,
      registrosInvalidos: dadosProcessados.filter(d => !d.valido).length,
      problemasDetectados: problemas,
      dados: dadosProcessados
    };

    res.render('resultado', { 
      resultado,
      user: req.session.user
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    res.status(500).render('error', {
      error: 'Erro ao processar arquivo',
      detalhes: error.message,
      user: req.session.user
    });
  }
});

// Função de processamento da planilha
async function processarPlanilha(caminhoArquivo) {
  const workbook = xlsx.readFile(caminhoArquivo);
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const dadosBrutos = xlsx.utils.sheet_to_json(planilha, { defval: '', raw: false });

  const resultados = [];
  const problemas = {
    camposVazios: {},
    formatosInvalidos: {}
  };

  dadosBrutos.forEach((linha, indice) => {
    const registro = { valido: true, erros: [] };
    const numLinha = indice + 2;

    for (const campo of CAMPOS_OBRIGATORIOS) {
      const chave = Object.keys(linha).find(k => 
        k.trim().toLowerCase() === campo.original.toLowerCase()
      );
      
      const valor = chave ? String(linha[chave] || '').trim() : '';

      if (campo.obrigatorio && !valor) {
        registro.valido = false;
        registro.erros.push(`${campo.normalizado}: vazio`);
        problemas.camposVazios[campo.normalizado] = (problemas.camposVazios[campo.normalizado] || 0) + 1;
        continue;
      }

      if (campo.tipo === 'cnpj' && valor && !validarCNPJ(valor)) {
        registro.valido = false;
        registro.erros.push(`${campo.normalizado}: CNPJ inválido`);
        problemas.formatosInvalidos.cnpj = (problemas.formatosInvalidos.cnpj || 0) + 1;
      }

      if (campo.tipo === 'cpf' && valor && !validarCPF(valor)) {
        registro.valido = false;
        registro.erros.push(`${campo.normalizado}: CPF inválido`);
        problemas.formatosInvalidos.cpf = (problemas.formatosInvalidos.cpf || 0) + 1;
      }

      registro[campo.normalizado] = valor;
    }

    registro._meta = {
        linha: numLinha,
        valido: registro.valido
    };

    resultados.push(registro);
});

  return {
    dadosProcessados: resultados,
    problemas
  };
}
// Funções auxiliares
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  return cnpj.length === 14;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  return cpf.length === 11;
}

// Iniciar servidor
app.listen(port, async () => {
  try {
    // Testar conexão com o banco de dados
    const connection = await pool.getConnection();
    console.log('Conexão com MySQL estabelecida com sucesso!');
    connection.release();
  } catch (err) {
    console.error('Erro ao conectar ao MySQL:', err);
  }
  
  console.log(`Servidor rodando em http://localhost:${port}`);
});