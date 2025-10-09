import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PublicIcon from "@mui/icons-material/Public";
import MessageIcon from "@mui/icons-material/Message";
import SearchIcon from "@mui/icons-material/Search";
import SpeedIcon from "@mui/icons-material/Speed";
import { SvgIconProps } from "@mui/material";

const iconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  Memory: MemoryIcon,
  Storage: StorageIcon,
  AccountTree: AccountTreeIcon,
  Public: PublicIcon,
  Message: MessageIcon,
  Search: SearchIcon,
  Speed: SpeedIcon
};

interface ServiceIconProps extends SvgIconProps {
  iconName: string;
}

const ServiceIcon = ({ iconName, ...props }: ServiceIconProps) => {
  const IconComponent = iconMap[iconName];
  
  if (!IconComponent) {
    return <StorageIcon {...props} />;
  }
  
  return <IconComponent {...props} />;
};

export default ServiceIcon;

