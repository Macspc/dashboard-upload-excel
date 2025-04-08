const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

// Configuração da sessão
app.use(session({
  secret: 'suaChaveSecreta',
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

// Dados de usuários
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$12$oBKlJoPQhVmvB8sBL5zK3eAVa7VVYjHpUQ8UTb1chL8RQ6Jxp3vhS' // admin123
  }
];

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
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return res.render('login', { error: 'Usuário não encontrado', username });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.render('login', { error: 'Senha incorreta', username });
  }

  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Rotas protegidas
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// Configuração dos campos obrigatórios
const CAMPOS_OBRIGATORIOS = [
  { original: 'CNPJ', normalizado: 'cnpj', tipo: 'cnpj', obrigatorio: true },
  { original: 'Endereço Empresa', normalizado: 'enderecoEmpresa', tipo: 'texto', obrigatorio: true },
  { original: '(DDD) Telefone', normalizado: 'telefone', tipo: 'texto', obrigatorio: true },
  { original: 'Nome do entregador', normalizado: 'entregador', tipo: 'texto', obrigatorio: true },
  { original: 'CPF', normalizado: 'cpf', tipo: 'cpf', obrigatorio: true },
  { original: 'Endereço de Partida', normalizado: 'enderecoPartida', tipo: 'texto', obrigatorio: true },
  { original: 'ID Viagem', normalizado: 'idViagem', tipo: 'texto', obrigatorio: true },
  { original: 'Status Viagem', normalizado: 'statusViagem', tipo: 'texto', obrigatorio: true },
  { original: 'Data', normalizado: 'data', tipo: 'texto', obrigatorio: true }
];

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
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Credenciais para teste:');
  console.log('Usuário: admin');
  console.log('Senha: admin123');
});