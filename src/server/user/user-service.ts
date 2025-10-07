import UserRepository from "@/server/user/user-repository";
import type { User, UserRecord } from "@/types/user";

class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  getById(id: string): User | null {
    const record = this.repository.findById(id);
    return record ? this.toUser(record) : null;
  }

  getByEmail(email: string): User | null {
    const record = this.repository.findByEmail(email);
    return record ? this.toUser(record) : null;
  }

  private toUser(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      createdAt: record.createdAt
    } satisfies User;
  }
}

export default UserService;
