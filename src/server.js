require("dotenv").config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const schedule = require('node-schedule');

// Configurações do bot
const app = express();
const bot = new Telegraf(process.env.KEY);

// Caminhos dos arquivos
const phrasesFilePath = path.join(__dirname, 'frases.json');
const userSchedulesFilePath = path.join(__dirname, 'user_schedules.json');

// Mapeamento de abreviações para números de dias da semana
const daysOfWeek = {
  "dom": 0,
  "seg": 1,
  "ter": 2,
  "qua": 3,
  "qui": 4,
  "sex": 5,
  "sab": 6
};

// Carregar o arquivo de frases
let phrases = [];
fs.readFile(phrasesFilePath, (err, data) => {
  if (err) {
    console.error('Erro ao carregar o arquivo de frases:', err);
  } else {
    phrases = JSON.parse(data);
  }
});

// Carregar o arquivo de agendamentos
let userSchedules = {};
fs.readFile(userSchedulesFilePath, (err, data) => {
  if (err) {
    console.error('Erro ao carregar o arquivo de agendamentos:', err);
  } else {
    userSchedules = JSON.parse(data);
  }
});

// Função para obter uma frase aleatória com emojis
function getRandomPhrase() {
  if (phrases.length === 0) {
    return 'Desculpe, não há frases disponíveis. 😔';
  }
  const randomIndex = Math.floor(Math.random() * phrases.length);
  const randomPhrase = phrases[randomIndex];
  return `🎉 "${randomPhrase.quote}" - ${randomPhrase.author} ✨`;
}

// Função para criar o teclado de menu
const createMenuKeyboard = () => Markup.keyboard([
  ['/frase', '/agendar'],
  ['/listar_agendamentos', '/excluir_agendamento'],
  ['/excluir_todos', '/sair']
]).resize();

// Função para enviar mensagens agendadas
function sendScheduledMessages() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

  for (const userId in userSchedules) {
    const userSchedule = userSchedules[userId];
    userSchedule.schedule.forEach(schedule => {
      const dayMatch = schedule.day === null || now.getDay() === schedule.day;
      if (schedule.time === currentTime && dayMatch) {
        const message = getRandomPhrase();
        bot.telegram.sendMessage(userId, message);
      }
    });
  }
}

// Agendar verificação a cada minuto
schedule.scheduleJob('* * * * *', sendScheduledMessages);

// Comando /start
bot.start((ctx) => {
  ctx.reply(
    `Olá ${ctx.from.first_name}, seja bem-vindo(a) ao bot de frases! 😊✨\n\nEscolha uma opção abaixo para começar:`,
    createMenuKeyboard()
  );
});

// Comando /frase
bot.command('frase', (ctx) => {
  try {
    const phrase = getRandomPhrase();
    ctx.reply(`✅😊 ${phrase} ❤️👍`, createMenuKeyboard());
  } catch (error) {
    console.error('Erro ao buscar a frase:', error);
    ctx.reply('Desculpe, ocorreu um erro ao buscar a frase. 😔', createMenuKeyboard());
  }
});



// Comando /agendar
bot.command('agendar', (ctx) => {
    const userId = ctx.from.id;
    const [command, dayAbbreviation, time] = ctx.message.text.split(' ');
  
    // Verificar se há dia e hora fornecidos
    if (!dayAbbreviation || !time) {
      ctx.reply('Uso correto: /agendar [DIA] HH:MM. Onde DIA é a abreviação do dia da semana (dom, seg, ter, qua, qui, sex, sab).', createMenuKeyboard());
      return;
    }
  
    // Convertendo abreviação para número do dia da semana
    const day = daysOfWeek[dayAbbreviation] !== undefined ? daysOfWeek[dayAbbreviation] : null;
  
    // Adicionar agendamento
    if (!userSchedules[userId]) {
      userSchedules[userId] = { schedule: [] };
    }
  
    userSchedules[userId].schedule.push({ day, time });
  
    fs.writeFile(userSchedulesFilePath, JSON.stringify(userSchedules, null, 2), (err) => {
      if (err) {
        console.error('Erro ao salvar o arquivo de agendamentos:', err);
        ctx.reply('Erro ao salvar o agendamento. 😔', createMenuKeyboard());
      } else {
        ctx.reply('Agendamento salvo com sucesso! 🎉 Para ver seus agendamentos, use o comando /listar_agendamentos.', createMenuKeyboard());
      }
    });
  });
  






// Comando /listar_agendamentos
bot.command('listar_agendamentos', (ctx) => {
  const userId = ctx.from.id;

  if (userSchedules[userId] && userSchedules[userId].schedule.length > 0) {
    let message = '📅 Seus agendamentos:\n';
    userSchedules[userId].schedule.forEach((schedule, index) => {
      const dayText = schedule.day !== null ? Object.keys(daysOfWeek).find(key => daysOfWeek[key] === schedule.day) : 'Todos os dias';
      message += `${index + 1}. Dia: ${dayText}, Hora: ${schedule.time}\n`;
    });
    ctx.reply(message, createMenuKeyboard());
  } else {
    ctx.reply('Você não tem nenhum agendamento ativo. 😔', createMenuKeyboard());
  }
});

// Comando /excluir_agendamento
bot.command('excluir_agendamento', (ctx) => {
  const userId = ctx.from.id;
  const messageParts = ctx.message.text.trim().split(/\s+/); // Corrigindo possíveis múltiplos espaços
  const agendamentoIndex = messageParts[1];

  if (!agendamentoIndex || isNaN(agendamentoIndex)) {
    ctx.reply('Uso correto: /excluir_agendamento [Número do agendamento]. Use o comando /listar_agendamentos para ver a lista.', createMenuKeyboard());
    return;
  }

  const index = parseInt(agendamentoIndex) - 1;

  if (userSchedules[userId] && userSchedules[userId].schedule.length > index && index >= 0) {
    userSchedules[userId].schedule.splice(index, 1);

    fs.writeFile(userSchedulesFilePath, JSON.stringify(userSchedules, null, 2), (err) => {
      if (err) {
        console.error('Erro ao salvar o arquivo de agendamentos:', err);
        ctx.reply('Erro ao excluir o agendamento. 😔', createMenuKeyboard());
      } else {
        ctx.reply('Agendamento excluído com sucesso! 🎉', createMenuKeyboard());
      }
    });
  } else {
    ctx.reply('Agendamento não encontrado ou número inválido. Verifique o número do agendamento e tente novamente.', createMenuKeyboard());
  }
});

// Comando /excluir_todos
bot.command('excluir_todos', (ctx) => {
  const userId = ctx.from.id;

  if (userSchedules[userId] && userSchedules[userId].schedule.length > 0) {
    userSchedules[userId].schedule = [];

    fs.writeFile(userSchedulesFilePath, JSON.stringify(userSchedules, null, 2), (err) => {
      if (err) {
        console.error('Erro ao salvar o arquivo de agendamentos:', err);
        ctx.reply('Erro ao excluir os agendamentos. 😔', createMenuKeyboard());
      } else {
        ctx.reply('Todos os seus agendamentos foram excluídos com sucesso! 🎉', createMenuKeyboard());
      }
    });
  } else {
    ctx.reply('Você não tem nenhum agendamento ativo para excluir. 😔', createMenuKeyboard());
  }
});

// Comando /sair
bot.command('sair', (ctx) => {
  ctx.reply('Obrigado por utilizar o bot de frases! 😄✨ Sempre que precisar, estaremos aqui. Até breve! ❤️', createMenuKeyboard());
});

// Iniciar o bot
bot.launch();

// Parar o bot ao receber SIGINT ou SIGTERM
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Iniciar o servidor Express
app.listen(3000, () => {
  console.log("Aplicação rodando na porta 3000");
});
