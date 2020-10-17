#!/bin/bash

yum update -y

#  installing docker
sudo yum install amazon-linux-extras docker -y
sudo usermod -a -G docker ssm-user
sudo chkconfig docker on
sudo service docker start



if [  -z "$REMOTE_IP" ]; then
 REMOTE_IP=$(curl -s https://api.ipify.org/?format=text)
fi



docker run -itd \
    --name openvpn \
    --privileged \
    -e EXTERNAL_HOST="${REMOTE_IP}" \
    -v /root/openvpnas_config \
    -p 9999:9999 \
    -p 8443:8443 \
    -p 8443:8443/udp \
    --restart=unless-stopped \
    jrromb/openvpn-as:latest