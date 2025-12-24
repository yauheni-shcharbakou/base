export class AuthService {
  private static email?: string
  
  static setEmail(email: string | null) {
    if (email) {
      this.email = email;
    }
  }
  
  static getEmail() {
    return this.email
  }
}