import './account-motion.css';
import { CustomerAuthProvider } from '@/features/clientes/components/CustomerAuthProvider';
import { CustomerAccountPage } from '@/features/clientes/pages/CustomerAccountPage';

export default function Page(){
  return <CustomerAuthProvider><CustomerAccountPage/></CustomerAuthProvider>;
}
