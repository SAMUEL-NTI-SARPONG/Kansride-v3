import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    // TODO: Fetch from DB
    return { id: userId, phoneNumber: '+233240000000', role: 'passenger', isVerified: true };
  }
}
