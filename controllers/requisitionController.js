const Requisition = require('../models/Requisition');

// GET /api/requisitions/approved
exports.getApprovedRequisitions = async (req, res) => {
  try {
    const requisitions = Requisition.getApproved();
    return res.status(200).json({
      success: true,
      count: requisitions.length,
      data: requisitions
    });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving requisitions' });
  }
};

// GET /api/requisitions/:id
exports.getRequisitionById = async (req, res) => {
  try {
    const requisition = Requisition.getById(req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }
    return res.status(200).json({ success: true, data: requisition });
  } catch (error) {
    console.error('Error fetching requisition:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving requisition' });
  }
};
