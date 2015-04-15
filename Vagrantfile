Vagrant.configure("2") do |config|

	config.vm.host_name = "aural"
	config.hostsupdater.aliases = ["aural"]
	

	config.vm.box = "aural"
	config.vm.box_url = "http://puppet-vagrant-boxes.puppetlabs.com/debian-70rc1-x64-vbox4210.box"

	config.vm.network :private_network, ip: "192.168.25.26"
	config.vm.network "forwarded_port", guest: 80, host: 2526
	config.vm.network "forwarded_port", guest: 3000, host: 3000
	config.ssh.forward_agent = true

	config.vm.provider :virtualbox do |v|
		v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
		v.customize ["modifyvm", :id, "--memory", 1024]
		v.customize ["modifyvm", :id, "--name", "aural"]
	end

	config.vm.synced_folder "./src", "/var/www", id: "vagrant-root" 
	config.vm.provision :shell, :inline =>
	"if [[ ! -f /apt-get-run ]]; then sudo apt-get update && sudo touch /apt-get-run; fi"

	config.vm.provision :shell, :inline => 'echo -e "mysql_root_password=8yourma
	controluser_password=awesome" > /etc/phpmyadmin.facts;'

	config.vm.provision :puppet do |puppet|
		puppet.manifests_path = "vagrant/manifests"
		puppet.module_path = "vagrant/modules"
		puppet.options = ['--verbose']
	end
end
