import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fname: string;

  @Column({ nullable: true })
  mname?: string;

  @Column()
  lname: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column()
  countryCode: string;

  @Column({ unique: true })
  phone: string;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column()
  houseNumber: string;

  @Column()
  street: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  country: string;

  @Column()
  pincode: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ type: 'date' })
  dob: Date;

  @Column({ default: 'email' }) // or 'google', 'github', etc.
  authType: string;

  @Column({ nullable: true })
  tempEmail?: string;

  @Column({ nullable: true })
  tempPhone?: string;

  @Column({ nullable: true })
  pendingEmail?: string; // For email update verification

  @Column({ nullable: true })
  pendingPhone?: string; // For phone update verification

  @Column({ default: false })
  is2FAEnabled: boolean;

  @Column({ nullable: true })
  twoFASecret?: string;

  @Column({ default: 'email,sms' })
  preferred2FAMethods: string; // comma-separated: email,sms,auth_app

  @Column({ nullable: true })
  socialId?: string; // Google/GitHub/etc. user ID

  @Column({ nullable: true })
  avatar?: string; // Profile picture URL

  @Column({ default: 1 })
  tokenVersion: number; // For invalidating refresh tokens

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastPasswordChange?: Date;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  lockedUntil?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
