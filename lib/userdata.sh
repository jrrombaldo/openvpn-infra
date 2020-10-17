#!/bin/bash

yum update -y

#  installing docker
sudo yum install amazon-linux-extras docker -y
sudo usermod -a -G docker ssm-user
sudo chkconfig docker on
sudo service docker start


