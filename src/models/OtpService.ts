import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn
} from 'typeorm';
import { User } from './User';

@Entity('otp_services')
export class OtpService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  otp: string;

  @Column({ nullable: true })
  secret?: string; // for 2FA TOTP

  @Column()
  type: 'email' | 'sms' | 'auth_app';

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({ nullable: true })
  purpose?: string; // e.g., 'registration', 'login', 'password_reset', 'email_update'

  @CreateDateColumn()
  createdAt: Date;
}
