declare module "whois-json" {
  interface WhoisResult {
    domainName?: string;
    registrar?: string;
    registrarName?: string;
    registryExpiryDate?: string;
    registrarRegistrationExpirationDate?: string;
    expirationDate?: string;
    [key: string]: unknown;
  }
  function whois(domain: string): Promise<WhoisResult | WhoisResult[]>;
  export default whois;
}
