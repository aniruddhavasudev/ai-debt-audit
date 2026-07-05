package com.example;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLSession;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;

public class InsecureClient {
    public X509TrustManager buildTrustManager() {
        return new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] certs, String authType) { }
            public void checkServerTrusted(X509Certificate[] certs, String authType) { }
            public X509Certificate[] getAcceptedIssuers() { return null; }
        };
    }

    public HostnameVerifier buildHostnameVerifier() {
        return new HostnameVerifier() {
            public boolean verify(String hostname, SSLSession session) { return true; }
        };
    }
}
