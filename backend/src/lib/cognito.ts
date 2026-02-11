// backend/src/lib/cognito.ts
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.AWS_REGION || "us-east-1";
const userPoolId = process.env.COGNITO_USER_POOL_ID || "";
const clientId = process.env.COGNITO_CLIENT_ID || "";

const cognitoClient = new CognitoIdentityProviderClient({ region });

export { userPoolId, clientId, region };

/**
 * Sign up a new user with username, password, and email.
 */
export async function signUp(username: string, password: string, email: string) {
  const command = new SignUpCommand({
    ClientId: clientId,
    Username: username,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
  return cognitoClient.send(command);
}

/**
 * Confirm sign-up with the verification code sent to email.
 */
export async function confirmSignUp(username: string, code: string) {
  const command = new ConfirmSignUpCommand({
    ClientId: clientId,
    Username: username,
    ConfirmationCode: code,
  });
  return cognitoClient.send(command);
}

/**
 * Resend the confirmation code to the user's email.
 */
export async function resendConfirmationCode(username: string) {
  const command = new ResendConfirmationCodeCommand({
    ClientId: clientId,
    Username: username,
  });
  return cognitoClient.send(command);
}

/**
 * Authenticate a user with username and password (USER_PASSWORD_AUTH flow).
 * Returns access, id, and refresh tokens.
 */
export async function signIn(username: string, password: string) {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });
  return cognitoClient.send(command);
}

/**
 * Refresh tokens using a refresh token.
 */
export async function refreshTokens(refreshToken: string) {
  const command = new InitiateAuthCommand({
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });
  return cognitoClient.send(command);
}

/**
 * Sign out globally (invalidate all tokens).
 */
export async function globalSignOut(accessToken: string) {
  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  });
  return cognitoClient.send(command);
}

/**
 * Get user info from an access token.
 */
export async function getUser(accessToken: string) {
  const command = new GetUserCommand({
    AccessToken: accessToken,
  });
  return cognitoClient.send(command);
}
