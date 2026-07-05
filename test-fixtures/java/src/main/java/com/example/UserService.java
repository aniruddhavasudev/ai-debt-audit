package com.example;

import java.io.File;
import java.io.ObjectInputStream;
import java.sql.Statement;
import java.util.Random;
import javax.xml.parsers.DocumentBuilderFactory;

public class UserService {

    public void queryUser(Statement stmt, String name) throws Exception {
        stmt.executeQuery("SELECT * FROM users WHERE name = '" + name + "'");
    }

    public void runCommand(String userInput) throws Exception {
        Runtime.getRuntime().exec("echo " + userInput);
    }

    public String generateToken() {
        String sessionToken = new Random().toString();
        return sessionToken;
    }

    public File serveFile(String baseDir, String userInput) {
        return new File(baseDir + userInput);
    }

    public void parseXml() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.newDocumentBuilder();
    }

    public Object restoreSession(ObjectInputStream stream) throws Exception {
        return stream.readObject();
    }
}
