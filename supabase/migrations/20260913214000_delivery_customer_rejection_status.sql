alter type public.delivery_assignment_status
  add value if not exists 'rejected_by_customer' after 'in_transit';
