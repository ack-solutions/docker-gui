import type { CreateContainerRequest } from "@/types/docker";

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  image: string;
  icon: string; // Material-UI icon name
  iconColor?: string;
  category: "database" | "cache" | "queue" | "web" | "other";
  defaultConfig: Omit<CreateContainerRequest, "image">;
}

export const serviceTemplates: ServiceTemplate[] = [
  {
    id: "redis",
    name: "Redis",
    description: "In-memory data structure store",
    image: "redis:latest",
    icon: "Memory",
    iconColor: "#DC382D",
    category: "cache",
    defaultConfig: {
      ports: [{ containerPort: 6379, hostPort: 6379, protocol: "tcp" }],
      env: [],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Advanced open source database",
    image: "postgres:16",
    icon: "Storage",
    iconColor: "#336791",
    category: "database",
    defaultConfig: {
      ports: [{ containerPort: 5432, hostPort: 5432, protocol: "tcp" }],
      env: [
        { key: "POSTGRES_PASSWORD", value: "postgres" },
        { key: "POSTGRES_USER", value: "postgres" },
        { key: "POSTGRES_DB", value: "mydb" }
      ],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Popular open source database",
    image: "mysql:8",
    icon: "Storage",
    iconColor: "#00758F",
    category: "database",
    defaultConfig: {
      ports: [{ containerPort: 3306, hostPort: 3306, protocol: "tcp" }],
      env: [
        { key: "MYSQL_ROOT_PASSWORD", value: "rootpassword" },
        { key: "MYSQL_DATABASE", value: "mydb" },
        { key: "MYSQL_USER", value: "user" },
        { key: "MYSQL_PASSWORD", value: "password" }
      ],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "NoSQL document database",
    image: "mongo:latest",
    icon: "AccountTree",
    iconColor: "#47A248",
    category: "database",
    defaultConfig: {
      ports: [{ containerPort: 27017, hostPort: 27017, protocol: "tcp" }],
      env: [
        { key: "MONGO_INITDB_ROOT_USERNAME", value: "admin" },
        { key: "MONGO_INITDB_ROOT_PASSWORD", value: "password" }
      ],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "nginx",
    name: "Nginx",
    description: "High-performance web server",
    image: "nginx:latest",
    icon: "Public",
    iconColor: "#009639",
    category: "web",
    defaultConfig: {
      ports: [
        { containerPort: 80, hostPort: 8080, protocol: "tcp" },
        { containerPort: 443, hostPort: 8443, protocol: "tcp" }
      ],
      env: [],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "rabbitmq",
    name: "RabbitMQ",
    description: "Message broker",
    image: "rabbitmq:3-management",
    icon: "Message",
    iconColor: "#FF6600",
    category: "queue",
    defaultConfig: {
      ports: [
        { containerPort: 5672, hostPort: 5672, protocol: "tcp" },
        { containerPort: 15672, hostPort: 15672, protocol: "tcp" }
      ],
      env: [
        { key: "RABBITMQ_DEFAULT_USER", value: "admin" },
        { key: "RABBITMQ_DEFAULT_PASS", value: "password" }
      ],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    description: "Search and analytics engine",
    image: "elasticsearch:8.11.0",
    icon: "Search",
    iconColor: "#005571",
    category: "other",
    defaultConfig: {
      ports: [
        { containerPort: 9200, hostPort: 9200, protocol: "tcp" },
        { containerPort: 9300, hostPort: 9300, protocol: "tcp" }
      ],
      env: [
        { key: "discovery.type", value: "single-node" },
        { key: "xpack.security.enabled", value: "false" }
      ],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  },
  {
    id: "memcached",
    name: "Memcached",
    description: "Distributed memory caching",
    image: "memcached:latest",
    icon: "Speed",
    iconColor: "#1F8DD6",
    category: "cache",
    defaultConfig: {
      ports: [{ containerPort: 11211, hostPort: 11211, protocol: "tcp" }],
      env: [],
      restartPolicy: "unless-stopped",
      autoStart: true
    }
  }
];

export const getTemplateById = (id: string): ServiceTemplate | undefined => {
  return serviceTemplates.find((template) => template.id === id);
};

export const getTemplatesByCategory = (category: ServiceTemplate["category"]) => {
  return serviceTemplates.filter((template) => template.category === category);
};

