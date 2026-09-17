import { Navigate, useLocation } from 'react-router-dom';
const Page = () => { const { search, hash } = useLocation(); return <Navigate to={`/marketing-privacy/ga4${search}${hash}`} replace />; };
export default Page;
