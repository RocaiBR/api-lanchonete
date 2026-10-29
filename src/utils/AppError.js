class AppError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
