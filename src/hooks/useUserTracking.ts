import {useAuth} from '@/contexts/AuthContext';
export const useUserTracking=()=>{const {user}=useAuth();return {userId:user?.id||null,userName:user?.name||null,userEmail:user?.email||null,isAuthenticated:!!user};};
