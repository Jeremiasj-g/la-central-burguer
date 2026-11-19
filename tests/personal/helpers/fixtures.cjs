'use strict';

const employee = (id='e1', overrides={}) => ({
  id, full_name: id === 'e1' ? 'Gabriel' : 'Jeremias', notes:null, profile_id:id,
  active:true, created_at:'2026-11-01', ...overrides,
});
const attendance = (id='a1', employeeId='e1', day='2026-11-16', overrides={}) => ({
  id, employee_id:employeeId, work_date:day, attendance_kind:'present',
  approval_status:'approved', notes:null, rate_id:'r1', amount_snapshot:15000, ...overrides,
});
const payroll = (id='p1', employeeId='e1', from='2026-11-16', to='2026-11-22', overrides={}) => ({
  id, employee_id:employeeId, period_from:from, period_to:to,
  notes:null, posted_at:'2026-11-22', ...overrides,
});
const line = (id='l1', payrollId='p1', attendanceId='a1', amount=15000) => ({
  id, payroll_id:payrollId, attendance_id:attendanceId, rate_amount_snapshot:amount,
});
const payment = (id='m1', overrides={}) => ({
  id, employee_id:'e1', payroll_id:'p1', payment_kind:'payroll',
  amount:3000, paid_on:'2026-11-17', notes:null, reversed_at:null,
  reversal_reason:null, ...overrides,
});
const allocation = (id='x1', overrides={}) => ({
  id, advance_id:'adv1', payroll_id:'p1', amount:2000,
  reversed_at:null, reversal_reason:null, ...overrides,
});
const dashboard = (overrides={}) => ({
  employees:[employee()], rates:[], attendance:[attendance()],
  payrolls:[], lines:[], payments:[], allocations:[], ...overrides,
});

module.exports = { employee, attendance, payroll, line, payment, allocation, dashboard };
