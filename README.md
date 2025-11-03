# SecureSphere Password Manager

A comprehensive browser extension for secure password management with decentralized backup capabilities, built for Chrome and Edge browsers using Manifest V3 architecture.

## Overview

SecureSphere Password Manager provides a secure, privacy-focused solution for managing passwords, credentials, and sensitive data. The extension implements industry-standard cryptographic practices, offers multiple authentication methods, and integrates with decentralized storage networks for user-controlled data backup.

## Core Features

### Authentication and Identity Management

The extension implements a seed phrase-based authentication system that mirrors the SecureSphere mobile application architecture.

**Seed Phrase Authentication**
- BIP39 mnemonic seed phrase support (12 or 24 words)
- BIP32 hierarchical deterministic key derivation using path `m/44'/0'/0'/0/0`
- Server-side registration and login with public key authentication
- Session persistence across browser restarts
- Secure private key storage with optional passphrase encryption

**QR Code Authentication**
- Mobile app login via QR code scanning
- Session-based authentication flow with real-time status polling
- Automatic session timeout handling
- Post-authentication seed phrase unlock for encryption features

**PIN-Based Quick Access**
- Optional 6-digit PIN for rapid access
- Session management with configurable timeouts
- Automatic logout on session expiration
- Secure PIN storage with seed phrase-derived encryption

**Private Key Management**
- In-memory private key storage (cleared on lock or tab close)
- Optional encrypted storage using PBKDF2 (100,000 iterations) and AES-GCM-256
- Passphrase-protected private key blobs
- Lock and unlock functionality for enhanced security

### Password and Credential Management

Comprehensive password management with encryption and organizational features.

**Credential Storage**
- Secure storage of passwords and wallet seed phrases
- AES-GCM encryption with seed-derived master keys
- Support for multiple credential types (passwords, wallets, notes)
- Automatic encryption of all stored data

**Password Generation**
- Configurable password generator with length and complexity options
- Support for uppercase, lowercase, numbers, and special characters
- Cryptographically secure random generation
- Password strength indicators

**Search and Organization**
- Real-time credential search functionality
- Filtering by type, tags, and metadata
- Fast retrieval of stored credentials
- Credential statistics and analytics

**Data Import and Export**
- Import from JSON and CSV formats
- Export credentials to encrypted backup files
- Batch operations for bulk credential management
- Data validation and integrity checking

### Breach Monitoring

Proactive security monitoring to detect compromised credentials.

**Email Breach Detection**
- Real-time checking against known breach databases
- Automatic extraction of email addresses from stored credentials
- Batch checking of multiple email addresses
- Integration with external breach detection APIs

**Breach Reporting**
- Detailed breach reports with breach dates and affected services
- Risk level assessment and categorization
- Security recommendations and remediation guidance
- Breach history tracking

**Monitoring Features**
- Proactive monitoring of stored email addresses
- Alert system for newly discovered breaches
- Breach statistics and analytics
- Historical breach data access

### File Vault

Encrypted file storage system with decentralized backup capabilities.

**File Management**
- Upload files to encrypted vault storage
- Download and decrypt files from vault
- Delete files from vault with confirmation
- File list management with metadata display

**Encryption**
- File-specific encryption keys derived from private key
- AES-CBC encryption with random initialization vectors
- Master key derivation from user's private key
- Secure file naming with original size preservation

**SIA Integration**
- Self-hosted SIA renterd node support
- Automatic bucket creation and management
- Secure authentication with API password
- Connection testing and validation

**Storage Modes**
- SecureSphere mode with user-specific buckets
- Self-hosted mode for complete data ownership
- Encrypted file storage with zero-knowledge architecture

### Decentralized Backup

Multiple backup options for data protection and recovery.

**Backup Storage Options**
- Local encrypted backup files
- Self-hosted SIA node backup
- SecureSphere decentralized server backup
- Cross-device synchronization capabilities

**Backup Management**
- Automatic backup creation
- Backup history tracking
- Restore from backup functionality
- Backup validation and integrity checking

**Backup Features**
- Encrypted backup file generation
- Backup metadata and timestamps
- Multiple backup retention policies
- Selective backup restoration

## Security Architecture

### Cryptographic Implementation

**Key Derivation**
- BIP39 seed phrase to master key derivation
- BIP32 hierarchical deterministic key paths
- PBKDF2 key derivation with 100,000+ iterations
- SHA-256 and SHA-512 hashing algorithms

**Encryption Standards**
- AES-GCM-256 for session and credential encryption
- AES-CBC-256 for file vault encryption
- Random salt and initialization vector generation
- Secure key management and storage

**Storage Security**
- Multi-layer encryption for stored data
- Anti-stealer protection mechanisms
- Memory-only private key storage
- Secure data cleanup on logout

### Session Management

**Session Security**
- Configurable session timeouts
- Automatic session expiration
- Session refresh on user activity
- Secure session clearing on logout

**Access Control**
- PIN-based quick access
- Seed phrase authentication
- QR code authentication flow
- Private key lock/unlock functionality

## Technical Architecture

### Modular Design

The extension follows a modular architecture with clear separation of concerns:

**Authentication Module** (`lib/auth/`)
- Core authentication logic with BIP39/BIP32 implementation
- QR authentication API, service, controller, and UI components
- Session management and secure key storage
- Server integration for registration and login

**Password Management Module** (`lib/password/`)
- Credential storage and retrieval
- Password generation utilities
- Import/export functionality
- Search and filtering capabilities

**Breach Monitoring Module** (`lib/breach/`)
- Breach detection service integration
- Email extraction and checking
- Breach reporting and analytics
- Risk assessment algorithms

**Vault Module** (`lib/vault/`)
- File encryption and decryption
- SIA renterd API client
- Vault UI components
- Storage management utilities



### Browser Integration

**Manifest V3 Compliance**
- Service worker background script
- ES modules support
- Content security policy configuration
- Host permissions for API access

**Storage Mechanisms**
- `chrome.storage.local` for session and encrypted data
- `chrome.storage.sync` for configuration and settings
- Secure storage with encryption layers
- Data persistence across browser restarts

**Message Passing**
- Runtime message handlers for component communication
- Content script integration
- Tab message broadcasting
- Error handling and retry logic

## User Interface

### Popup Interface

**Authentication Tabs**
- Seed Login tab for seed phrase authentication
- QR Login tab for mobile app authentication
- Status tab for session management

**Password Management**
- Credential list with search and filtering
- Add/edit credential forms
- Password generator interface
- Import/export controls

**Breach Monitoring**
- Breach checking interface
- Results display with risk indicators
- Breach statistics and history
- Monitoring controls

**File Vault**
- File upload with drag-and-drop support
- File list with download and delete options
- Connection testing interface
- Storage configuration

### Options Page

**Authentication Configuration**
- Backend base URL setup
- API key configuration
- QR authentication settings

**Vault Configuration**
- SIA renterd host and port settings
- API password configuration
- Storage mode selection
- Vault passphrase management

**Settings Management**
- Session timeout configuration
- Auto-lock settings
- Backup preferences
- Security options

## Data Privacy and Security

### Privacy Principles

**Zero-Knowledge Architecture**
- All encryption keys derived from user seed phrase
- No server-side storage of sensitive data
- Local-first data storage
- Encrypted communication with backend services

**Data Ownership**
- User-controlled private keys
- Optional self-hosted storage
- Export capabilities for data portability
- No third-party data sharing

### Security Measures

**Protection Against Common Threats**
- Anti-stealer protection with multi-layer encryption
- Memory protection for sensitive data
- Secure session management
- Input validation and sanitization

**Best Practices**
- Industry-standard cryptographic algorithms
- Secure key derivation practices
- Proper error handling without information leakage
- No logging of sensitive information

## Browser Compatibility

**Supported Browsers**
- Google Chrome (Manifest V3)
- Microsoft Edge (Manifest V3)
- Chromium-based browsers



## Acknowledgments

This project is made possible through a grant from the SIA Foundation. The SIA Foundation supports innovative projects that leverage decentralized storage technologies and promote user data sovereignty. Their support has enabled the development of secure, privacy-focused tools that give users complete control over their data.

The integration with the SIA decentralized storage network provides users with a truly decentralized backup solution, ensuring data resilience and independence from centralized service providers. This aligns with the foundation's mission to promote decentralized technologies and user empowerment.
https://sia.tech/grants
