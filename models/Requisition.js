const { readCollection, writeCollection } = require('../config/database');

class Requisition {
  static getAll() {
    return readCollection('requisitions');
  }

  static getApproved() {
    return this.getAll().filter(r => r.status === 'Approved');
  }

  static getById(id) {
    return this.getAll().find(r => r.id === id) || null;
  }
}

module.exports = Requisition;
