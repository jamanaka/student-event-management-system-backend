const express = require("express");
const router = express.Router();
const {
  addRSVP,
  removeRSVP,
  getEventAttendees,
  getUserRSVPs,
  checkRSVPStatus,
  updateRSVP,
} = require("../controllers/rsvp.controller");
const { protect } = require("../middleware/auth.middleware");
const {
  eventValidations,
  rsvpValidations,
} = require("../middleware/validation.middleware");

// Routes
router.get("/my-rsvps", protect, getUserRSVPs);
router.get(
  "/check/:eventId",
  protect,
  eventValidations.eventIdParamForRSVP,
  checkRSVPStatus
);
// #region agent log
router.post(
  "/:eventId",
  (req, res, next) => {
    fetch('http://127.0.0.1:7243/ingest/27ef663c-654d-4526-a1e9-cc23ba613f19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rsvp.routes.js:25',message:'POST route entry',data:{eventId:req.params.eventId,nextType:typeof next,nextIsFunction:typeof next==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    next();
  },
  protect,
  (req, res, next) => {
    fetch('http://127.0.0.1:7243/ingest/27ef663c-654d-4526-a1e9-cc23ba613f19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rsvp.routes.js:32',message:'After protect, before validation',data:{nextType:typeof next,nextIsFunction:typeof next==='function',userId:req.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    next();
  },
  rsvpValidations.createRSVP,
  (req, res, next) => {
    fetch('http://127.0.0.1:7243/ingest/27ef663c-654d-4526-a1e9-cc23ba613f19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rsvp.routes.js:39',message:'After validation, before controller',data:{nextType:typeof next,nextIsFunction:typeof next==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    next();
  },
  addRSVP
);
// #endregion
router.put("/:eventId", protect, eventValidations.eventIdParamForRSVP, updateRSVP);
router.delete("/:eventId", protect, eventValidations.eventIdParamForRSVP, removeRSVP);
router.get(
  "/event/:eventId/attendees",
  eventValidations.eventIdParamForRSVP,
  getEventAttendees
);

module.exports = router;
