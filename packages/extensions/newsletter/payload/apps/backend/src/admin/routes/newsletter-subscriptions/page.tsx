import { Navigate, useLocation } from 'react-router-dom';
const Page = () => { const { search, hash } = useLocation(); return <Navigate to={`/marketing-privacy/newsletter${search}${hash}`} replace />; };
export default Page;
