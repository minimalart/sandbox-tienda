import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BrandDetail = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/brands', { replace: true });
  }, [navigate]);

  return null;
};

export default BrandDetail;
